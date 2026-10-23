import { npcaAudit } from './storage.mjs';
export class NpcaError extends Error {
  constructor(code, httpStatus = 0, details = null) {
    super(code); this.code = code; this.httpStatus = httpStatus; this.details = details;
  }
}
export const errorText = error => ({
  disabled: 'មិនទាន់បើកការតភ្ជាប់ NPCA ទេ។', configuration: 'សូមបំពេញការកំណត់ NPCA ជាមុន។',
  network: 'មិនអាចភ្ជាប់ NPCA បានទេ។ សូមព្យាយាមម្តងទៀត។', authentication: 'មិនអាចផ្ទៀងផ្ទាត់គណនី NPCA បានទេ។',
  response: 'NPCA បានបដិសេធសំណើ។ សូមពិនិត្យព័ត៌មានលម្អិត។',
}[error.code] || 'មិនអាចបំពេញសំណើ NPCA បានទេ។');

export class NpcaClient {
  constructor(config, database, { fetchImpl = fetch } = {}) {
    this.config = config; this.database = database; this.fetch = fetchImpl;
    Object.defineProperties(this,{token:{value:null,writable:true},refreshToken:{value:null,writable:true},knownSecrets:{value:new Set([config.clientSecret,config.password].filter(Boolean))}});
    this.expiresAt = 0; this.lastTokenAt = null; this.tokenRequest = null;
  }
  redact(value) {
    let text = typeof value === 'string' ? value : JSON.stringify(value ?? null);
    for (const secret of this.knownSecrets) text = text.split(secret).join('[redacted]');
    return text.slice(0, 16000);
  }
  assertEnabled() {
    if (!this.config.enabled) throw new NpcaError('disabled');
    if (!['baseUrl','clientId','clientSecret','username','password','systemCode','facilityCode'].every(key => this.config[key])) throw new NpcaError('configuration');
  }
  async transport(name, values, token) {
    this.assertEnabled();
    const endpoint = this.config.endpoints[name];
    if(name==='token'&&endpoint.method==='GET')throw new NpcaError('configuration');
    const url = new URL(endpoint.path, this.config.baseUrl);
    if (url.origin !== this.config.baseUrl) throw new NpcaError('configuration');
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json', 'X-System-Code': this.config.systemCode, 'X-Health-Facility-Code': this.config.facilityCode };
    if (token) headers.Authorization = 'Bearer ' + token;
    const options = { method: endpoint.method, headers, redirect: 'error', signal: AbortSignal.timeout(this.config.timeoutMs) };
    if (endpoint.method === 'GET') for (const [key, value] of Object.entries(values || {})) url.searchParams.set(key, value);
    else options.body = JSON.stringify(values);
    let response;
    try { response = await this.fetch(url, options); }
    catch { throw new NpcaError('network'); }
    let body;
    try { body = await response.json(); }
    catch { throw new NpcaError('response', response.status); }
    if (!response.ok || body?.success === false) {
      // Token endpoints never persist or expose their response bodies.
      throw new NpcaError(name === 'token' ? 'authentication' : 'response', response.status, name === 'token' ? null : { message: this.redact(body.message), errors: this.redact(body.errors) });
    }
    return body;
  }
  async getToken(actorId = null, force = false) {
    this.assertEnabled();
    if (!force && this.token && Date.now() < this.expiresAt) return this.token;
    if (this.tokenRequest) return this.tokenRequest;
    this.tokenRequest = (async () => {
      const get = async refresh => {
        npcaAudit(this.database, 'TOKEN_REQUEST', { actorId });
        try {
          const values = { grant_type: refresh ? 'refresh_token' : 'password', client_id: this.config.clientId, client_secret: this.config.clientSecret,
            ...(refresh ? { refresh_token: this.refreshToken } : { username: this.config.username, password: this.config.password }) };
          const body = await this.transport('token', values);
          if (!body.access_token || !(Number(body.expires_in) > 0)) throw new NpcaError('authentication');
          this.token = body.access_token; this.refreshToken = body.refresh_token || null;
          this.knownSecrets.add(this.token);if(this.refreshToken)this.knownSecrets.add(this.refreshToken);
          this.expiresAt = Date.now() + Math.max(0, Number(body.expires_in) * 1000 - Math.min(60000, Number(body.expires_in) * 100));
          this.lastTokenAt = Date.now();
          npcaAudit(this.database, 'TOKEN_SUCCESS', { actorId });
          return this.token;
        } catch (error) { npcaAudit(this.database, 'TOKEN_FAILED', { actorId, httpStatus: error.httpStatus || 0 }); throw error; }
      };
      if (this.refreshToken) {
        try { return await get(true); }
        catch (error) { if (![400,401].includes(error.httpStatus)) throw error; this.refreshToken = null; }
      }
      return get(false);
    })();
    try { return await this.tokenRequest; } finally { this.tokenRequest = null; }
  }
  async request(name, values, { actorId, patientKey, visitCode } = {}) {
    this.assertEnabled();
    const auditAction = { search: 'BENEFICIARY_SEARCH', submit: 'SUBMISSION', processed: 'STATUS_CHECK' }[name];
    if (!auditAction) throw new NpcaError('configuration');
    npcaAudit(this.database, auditAction, { actorId, patientKey, visitCode });
    let token = await this.getToken(actorId);
    try { return await this.transport(name, values, token); }
    catch (error) {
      if (error.httpStatus !== 401) { npcaAudit(this.database, auditAction + '_FAILED', { actorId, patientKey, visitCode, httpStatus: error.httpStatus || 0 }); throw error; }
      token = await this.getToken(actorId, true);
      try { return await this.transport(name, values, token); }
      catch (retryError) { npcaAudit(this.database, auditAction + '_FAILED', { actorId, patientKey, visitCode, httpStatus: retryError.httpStatus || 0 }); throw retryError; }
    }
  }
}
