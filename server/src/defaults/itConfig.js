/** Default IT system configuration — seeded on first run */

export const DEFAULT_SMTP = {
  enabled: false,
  deliveryMethod: 'brevo_api',
  host: '',
  port: 587,
  secure: false,
  user: '',
  password: '',
  brevoApiKey: '',
  fromName: 'VeriTrack · Rizal MAO',
  fromEmail: 'noreply@rizal-palawan.gov.ph',
};

/** Brevo (Sendinblue) SMTP relay preset */
export const BREVO_SMTP_PRESET = {
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
};

export const DEFAULT_EMAIL_TEMPLATES = {
  email_verification: {
    key: 'email_verification',
    label: 'Email Verification',
    subject: 'Verify your VeriTrack account',
    heading: 'Email Verification',
    greeting: 'Hello {{name}},',
    body:
      'Thank you for registering with VeriTrack Solutions. Please verify your email address to activate your account and access municipal assessment services.',
    buttonText: 'Verify Email Address',
    buttonColor: '#1e3a8a',
    accentColor: '#1e3a8a',
    footer: 'Municipality of Rizal, Palawan · Municipal Assessor\'s Office',
    variables: ['{{name}}', '{{email}}', '{{verifyLink}}', '{{expiryHours}}'],
  },
  forgot_password: {
    key: 'forgot_password',
    label: 'Forgot Password',
    subject: 'Your VeriTrack sign-in code',
    heading: 'Forgot Password',
    greeting: 'Hello {{name}},',
    body:
      'Use the verification code below to sign in to VeriTrack. This code expires in {{expiryMinutes}} minutes. If you did not request this, you can ignore this email.',
    buttonText: '',
    buttonColor: '#1e3a8a',
    accentColor: '#1e3a8a',
    footer: 'Municipality of Rizal, Palawan · Municipal Assessor\'s Office',
    variables: ['{{name}}', '{{email}}', '{{code}}', '{{expiryMinutes}}'],
  },
  login_alert: {
    key: 'login_alert',
    label: 'Login Alert',
    subject: 'New sign-in to your VeriTrack account',
    heading: 'Security Notice',
    greeting: 'Hello {{name}},',
    body:
      'Your account was used to sign in to VeriTrack. If this was you, no action is needed. If you do not recognize this activity, contact IT support immediately.',
    buttonText: 'Review Activity',
    buttonColor: '#1e3a8a',
    accentColor: '#f59e0b',
    footer: 'Municipality of Rizal, Palawan · Municipal Assessor\'s Office',
    variables: ['{{name}}', '{{time}}', '{{ip}}', '{{device}}'],
  },
};

export const DEFAULT_GIS = {
  defaultCenter: { lat: 8.9597, lng: 117.6586 },
  defaultZoom: 14,
  minZoom: 10,
  maxZoom: 19,
  street: {
    label: 'Map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    enabled: true,
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    enabled: true,
  },
  apiKey: '',
  tileProviderNote: 'OpenStreetMap and Esri public tiles — no API key required. Add a key if using Mapbox or Google Maps.',
};
