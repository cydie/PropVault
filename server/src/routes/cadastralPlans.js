import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired, requireRoles } from '../middleware/auth.js';
import {
  listSurveyPlans,
  getSurveyPlan,
  createSurveyPlan,
  updateSurveyPlan,
  attachParcelToPlan,
} from '../services/surveyPlanService.js';

const router = Router();
router.use(authRequired);
const canEdit = requireRoles('Admin', 'Staff Assessor');

router.get('/survey-plans', async (_req, res, next) => {
  try {
    const plans = await listSurveyPlans();
    res.json({ plans });
  } catch (err) {
    next(err);
  }
});

router.get('/survey-plans/:id', async (req, res, next) => {
  try {
    const plan = await getSurveyPlan(Number(req.params.id));
    if (!plan) return res.status(404).json({ error: 'Survey plan not found' });
    res.json(plan);
  } catch (err) {
    next(err);
  }
});

router.post('/survey-plans', canEdit, async (req, res, next) => {
  try {
    const userId = req.user?.id ?? null;
    const plan = await createSurveyPlan(req.body, userId);
    res.status(201).json(plan);
  } catch (err) {
    next(err);
  }
});

router.put('/survey-plans/:id', canEdit, async (req, res, next) => {
  try {
    const plan = await updateSurveyPlan(Number(req.params.id), req.body);
    if (!plan) return res.status(404).json({ error: 'Survey plan not found' });
    res.json(plan);
  } catch (err) {
    next(err);
  }
});

router.post('/survey-plans/:id/attach-parcel', canEdit, async (req, res, next) => {
  try {
    const surveyPlanId = Number(req.params.id);
    const parcelId = Number(req.body.parcelId);
    if (!parcelId) return res.status(400).json({ error: 'parcelId is required' });
    const plan = await getSurveyPlan(surveyPlanId);
    if (!plan) return res.status(404).json({ error: 'Survey plan not found' });
    await attachParcelToPlan(parcelId, surveyPlanId);
    if (req.body.sectionNo != null || req.body.blkNo != null) {
      await pool.query(
        `UPDATE gis_parcels SET
           section_no = COALESCE($2, section_no),
           blk_no = COALESCE($3, blk_no),
           updated_at = now()
         WHERE id = $1`,
        [parcelId, req.body.sectionNo ?? null, req.body.blkNo ?? null],
      );
    }
    res.json(await getSurveyPlan(surveyPlanId));
  } catch (err) {
    next(err);
  }
});

export default router;
