const endpoints = {
  token: ['POST', '/oauth/token'], search: ['GET', '/api/v1/external/beneficiary/search'],
  submit: ['POST', '/api/v1/external/visits'], processed: ['GET', '/api/v1/external/visits/processed'],
};
export function npcaSettings(overrides = {}, env = process.env) {
  const get = (key, fallback = '') => overrides[key] ?? env['NPCA_' + key.replace(/[A-Z]/g, c => '_' + c).toUpperCase().replace(/^_/, '')] ?? fallback;
  const flag = (key, fallback) => String(get(key, fallback)) === 'true';
  const config = { enabled: flag('enabled', false), baseUrl: get('baseUrl'), clientId: get('clientId'), clientSecret: get('clientSecret'),
    username: get('username'), password: get('password'), systemCode: get('systemCode'), facilityCode: get('facilityCode'),
    pollHours: Number(get('pollHours', 8)), sendForms: flag('sendForms', true), timeoutMs: Number(get('timeoutMs', 15000)),
    // Explicit test-only option; no environment switch can permit insecure remote traffic.
    localMock: overrides.localMock === true, endpoints: {} };
  for (const [name, [method, path]] of Object.entries(endpoints)) {
    const cap = name[0].toUpperCase() + name.slice(1);
    config.endpoints[name] = { method: String(get(name + 'Method', method)).toUpperCase(), path: get(name + 'Path', path) };
    if (!['GET', 'POST', 'PUT', 'PATCH'].includes(config.endpoints[name].method) || !/^\/(?!\/)[^#]*$/.test(config.endpoints[name].path) || config.endpoints[name].path.includes('://')) throw new Error('Invalid NPCA endpoint: ' + cap);
  }
  if (!(config.pollHours > 0) || !(config.timeoutMs > 0 && config.timeoutMs <= 120000)) throw new Error('Invalid NPCA timeout or polling interval.');
  if (config.baseUrl) {
    const url = new URL(config.baseUrl);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('NPCA_BASE_URL must be an origin without credentials.');
    if (url.protocol !== 'https:' && !(config.localMock && url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('NPCA requires HTTPS.');
    config.baseUrl = url.origin;
  }
  for(const key of ['clientId','clientSecret','username','password'])Object.defineProperty(config,key,{value:config[key],enumerable:false,writable:false});
  return config;
}
export function publicSettings(config) {
  return { enabled: config.enabled, baseUrl: config.baseUrl, facilityCode: config.facilityCode, systemCode: config.systemCode,
    sendForms: config.sendForms, pollHours: config.pollHours, endpoints: config.endpoints,
    configured: ['baseUrl','clientId','clientSecret','username','password','systemCode','facilityCode'].every(key => Boolean(config[key])) };
}
