// Version 95dea66d6fcf524c12facef6adbf8ffd1bcb42fcf75f800811ea794c61afd363; phase: bounded-action job integration candidate, action-trial build; runtime acceptance pending.
(function(){'use strict';
let __binding;
const __factories=Object.create(null),__cache=Object.create(null);
function __require(id){
 if(__cache[id])return __cache[id].exports;
 if(!Object.prototype.hasOwnProperty.call(__factories,id))throw Error('unknown_module');
 const m={exports:{}};__cache[id]=m;
 const require=rel=>{const p=id.split('/').slice(0,-1);for(const s of rel.split('/')){
  if(s==='..')p.pop();else if(s!=='.')p.push(s);}return __require(p.join('/'));};
 __factories[id](m,m.exports,require);return m.exports;
}
const __codeId="95dea66d6fcf524c12facef6adbf8ffd1bcb42fcf75f800811ea794c61afd363";
const __capabilities=Object.freeze({"actionsQualified": true});
__factories["src/core/detector"]=function(module,exports,require){
/* Pure, bounded, causal observer. No I/O and no connection-control capability. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VidHubDetector = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DEFAULTS = Object.freeze({
    host: __binding.host, port: 443, deviceName: __binding.deviceName,
    activity_window_s: 0.4, activity_bytes: 16384, quiet_confirmation_s: 0.6,
    speed_window_s: 1, minimum_evidence_s: 0.4, low_confirmation_s: 0.4,
    slow_Bps: 2000000, maximum_gap_s: 0.5, maximum_read_ms: 250,
    resume_bytes: 65536, recovery_window_s: 0.4, recovery_hold_s: 0.4,
    history_s: 3, max_snapshots: 64, max_target_ids: 8,
    quarantine_unreliable_intervals: true
  });
  const finite = n => typeof n === 'number' && Number.isFinite(n);
  const integer = n => Number.isSafeInteger(n) && n >= 0;
  function before(rows, key, cutoff) {
    let i = rows.length - 1;
    while (i > 0 && rows[i][key] > cutoff) i--;
    return i;
  }
  function anchorPosition(rows, index) {
    let i = 0;
    while (i < rows.length - 1 && rows[i].index < index) i++;
    return i;
  }
  class Detector {
    constructor(options) {
      this.p = Object.assign({}, DEFAULTS, options || {});
      if (Object.keys(this.p).some(k => !(k in DEFAULTS)) ||
          typeof this.p.quarantine_unreliable_intervals !== 'boolean') throw new Error('invalid_parameter');
      for (const k of ['host','port','deviceName'])
        if (this.p[k] !== DEFAULTS[k]) throw new Error('target_scope_is_fixed');
      Object.keys(DEFAULTS).forEach(k => {
        if (typeof DEFAULTS[k] === 'number' && (!finite(this.p[k]) || this.p[k] <= 0))
          throw new Error('invalid_parameter');
      });
      for (const k of ['port', 'max_snapshots', 'max_target_ids'])
        if (!integer(this.p[k])) throw new Error('invalid_integer_parameter');
      if (this.p.history_s < Math.max(this.p.speed_window_s, this.p.activity_window_s,
          this.p.recovery_window_s) + this.p.maximum_gap_s || this.p.max_snapshots < 3)
        throw new Error('history_too_short');
      this.s = {
        index: -1, origin: null, lastTime: null, total: 0, rows: [], previous: [],
        state: 'WAIT', phaseAnchor: null, boundaryAnchor: null, quietSince: null,
        lowSince: null, emitted: false, recoveryUsed: false, holdUntil: null,
        protected: false, protectionAt: null, resumedBytes: 0, positiveReads: 0
      };
    }
    clearEpisode() {
      Object.assign(this.s, {lowSince: null, emitted: false, recoveryUsed: false, holdUntil: null});
    }
    protect() {
      Object.assign(this.s, {protected: true, protectionAt: this.s.index,
        resumedBytes: 0, positiveReads: 0});
      this.clearEpisode();
    }
    discardEvidence() {
      // Protection is deliberately independent of the rolling measurement history.
      Object.assign(this.s, {rows: [], previous: [], lastTime: null, state: 'UNCERTAIN',
        phaseAnchor: null, boundaryAnchor: null, quietSince: null});
      this.clearEpisode();
    }
    select(frame) {
      if (!frame || !finite(frame.time_s) || !finite(frame.read_ms) || frame.read_ms < 0 ||
          !Array.isArray(frame.targets)) throw new Error('invalid_sample');
      const selected = [], seen = new Set();
      for (const row of frame.targets) {
        if (!row || typeof row !== 'object') throw new Error('invalid_row');
        if (row.host !== this.p.host || row.port !== this.p.port || row.local !== true ||
            row.deviceName !== this.p.deviceName || row.completed || row.failed) continue;
        if (!integer(row.id) || !integer(row.inBytes) || seen.has(row.id))
          throw new Error('invalid_target_counter_or_id');
        if (typeof row.completed !== 'boolean' || typeof row.failed !== 'boolean')
          throw new Error('invalid_target_status');
        seen.add(row.id);
        selected.push([row.id, row.inBytes]);
        if (selected.length > this.p.max_target_ids) throw new Error('target_capacity');
      }
      return selected;
    }
    ingest(frame, protectionMarker) {
      const s = this.s, p = this.p;
      let current;
      try { current = this.select(frame); }
      catch (e) {
        this.discardEvidence();
        return {state: 'UNCERTAIN', candidate: false, protected: s.protected,
          decision_reason: e.message, reliable_read: false, needs_baseline: true};
      }
      const now = frame.time_s;
      if (s.lastTime !== null && now <= s.lastTime) {
        this.discardEvidence();
        return {state: 'UNCERTAIN', candidate: false, protected: s.protected,
          decision_reason: 'non_increasing_clock', reliable_read: false, needs_baseline: true};
      }
      if (s.origin === null) s.origin = now;
      const rel = now - s.origin, oldTime = s.lastTime;
      const oldRel = oldTime === null ? rel : oldTime - s.origin;
      const previous = new Map(s.previous), present = new Map(current);
      let changes = current.filter(r => previous.has(r[0])).map(r => [r[0], r[1] - previous.get(r[0])]);
      const invalidCounter = changes.some(r => r[1] < 0);
      const reliable = !invalidCounter && (oldTime === null || now - oldTime <= p.maximum_gap_s)
        && frame.read_ms <= p.maximum_read_ms;
      const newOrGrowing = current.some(r => !previous.has(r[0]) || r[1] > previous.get(r[0]));
      // Invalid intervals never enter a later speed window or release protection.
      if (!reliable && p.quarantine_unreliable_intervals) { this.discardEvidence(); changes = []; }
      else changes = changes.map(r => [r[0], Math.max(0, r[1])]);
      const amount = changes.reduce((sum, r) => sum + r[1], 0);
      if (!integer(s.total + amount)) {
        this.discardEvidence();
        return {state: 'UNCERTAIN', candidate: false, protected: s.protected,
          decision_reason: 'counter_precision_limit', reliable_read: false, needs_baseline: true};
      }
      s.total += amount; s.index++; s.lastTime = now; s.previous = current;
      const row = {index: s.index, time: now, rel, total: s.total, amount, changes};
      s.rows.push(row);
      let trim = before(s.rows, 'time', now - p.history_s);
      if (trim > 0) s.rows.splice(0, trim);
      if (s.rows.length > p.max_snapshots) {
        this.discardEvidence();
        s.rows = [Object.assign({}, row, {amount: 0, changes: []})];
        s.lastTime = now; s.previous = current;
        return {state: 'UNCERTAIN', candidate: false, protected: s.protected,
          decision_reason: 'history_capacity', reliable_read: false, needs_baseline: true};
      }
      const rows = s.rows;
      if (protectionMarker) { this.protect(); s.state = 'WAIT'; s.phaseAnchor = null; }
      else if (s.protected && (reliable || !p.quarantine_unreliable_intervals)) {
        s.resumedBytes = Math.min(p.resume_bytes, s.resumedBytes + amount);
        if (amount > 0) s.positiveReads = Math.min(2, s.positiveReads + 1);
      }
      let a = before(rows, 'time', now - p.activity_window_s);
      if (s.protected) a = Math.max(a, anchorPosition(rows, s.protectionAt));
      const recentBytes = s.total - rows[a].total;
      let active = recentBytes >= p.activity_bytes;
      if (s.protected) {
        if ((reliable || !p.quarantine_unreliable_intervals) && active && s.resumedBytes >= p.resume_bytes && s.positiveReads >= 2)
          s.protected = false;
        else active = false;
      }
      const previousState = s.state;
      if (!reliable) {
        s.state = 'UNCERTAIN'; s.phaseAnchor = null; s.quietSince = null;
      } else if (active) {
        if (s.state === 'WAIT' || s.state === 'UNCERTAIN' || s.phaseAnchor === null) {
          let first = a + 1;
          while (first < rows.length - 1 && rows[first].amount <= 0) first++;
          s.phaseAnchor = rows[Math.max(a, first - 1)].index;
        }
        s.state = 'DOWNLOAD'; s.quietSince = null;
      } else {
        if (s.quietSince === null) s.quietSince = now;
        s.state = s.protected || now - s.quietSince >= p.quiet_confirmation_s ? 'WAIT' : 'SETTLING';
        if (s.state === 'WAIT') s.phaseAnchor = null;
      }
      let rate = null, mainId = null, shortRate = null, shortSpan = null;
      if (s.state === 'DOWNLOAD') {
        const j = Math.max(anchorPosition(rows, s.phaseAnchor), before(rows, 'time', now - p.speed_window_s));
        const growth = new Map();
        for (let k = j + 1; k < rows.length; k++)
          for (const [id, delta] of rows[k].changes)
            if (present.has(id)) growth.set(id, (growth.get(id) || 0) + delta);
        let largest = 0;
        for (const [id, value] of growth) if (value > largest) { largest = value; mainId = id; }
        const span = now - rows[j].time;
        if (span >= p.minimum_evidence_s && mainId !== null) rate = (s.total - rows[j].total) / span;
      }
      const mainDelta = mainId !== null && previous.has(mainId) ? present.get(mainId) - previous.get(mainId) : 0;
      const currentFloor = p.activity_bytes * (rel - oldRel) / p.activity_window_s;
      const meaningful = mainDelta > 0 && mainDelta >= currentFloor;
      let candidate = false, reason;
      if (s.state === 'WAIT' || s.state === 'UNCERTAIN' || s.protected) {
        this.clearEpisode(); s.boundaryAnchor = null;
        reason = 'waiting_or_uncertain_or_protected';
      } else if (s.state === 'SETTLING') reason = 'settling_no_candidate';
      else {
        if (previousState === 'WAIT' || previousState === 'UNCERTAIN' || s.boundaryAnchor === null) {
          const b = before(rows, 'rel', rel - p.activity_window_s);
          let first = b + 1;
          while (first < rows.length - 1 && rows[first].amount <= 0) first++;
          s.boundaryAnchor = rows[Math.max(b, first - 1)].index;
        }
        const j = Math.max(anchorPosition(rows, s.boundaryAnchor), before(rows, 'rel', rel - p.recovery_window_s));
        shortSpan = rel - rows[j].rel;
        if (shortSpan + 1e-9 >= Math.min(p.minimum_evidence_s, p.recovery_window_s))
          shortRate = (s.total - rows[j].total) / shortSpan;
        if (rate === null) reason = 'insufficient_speed_evidence';
        else if (rate >= p.slow_Bps) { this.clearEpisode(); reason = 'window_speed_recovered'; }
        else {
          if (s.lowSince === null) s.lowSince = rel;
          if (s.emitted) reason = 'already_recorded_this_episode';
          else if (rel - s.lowSince < p.low_confirmation_s) reason = 'confirming_low_speed';
          else if (!meaningful) reason = 'current_growth_not_substantial';
          else if (s.holdUntil !== null && rel < s.holdUntil) reason = 'bounded_recovery_observation';
          else if (!s.recoveryUsed && shortRate !== null && shortRate >= p.slow_Bps) {
            s.recoveryUsed = true; s.holdUntil = rel + p.recovery_hold_s;
            reason = 'start_one_recovery_observation';
          } else { candidate = true; s.emitted = true; reason = 'productive_low_speed_candidate'; }
        }
      }
      return {
        index: s.index, elapsed_s: rel, state: s.state, candidate, protected: s.protected,
        reliable_read: reliable, phase_rate_Bps: rate, short_rate_Bps: shortRate,
        short_span_s: shortSpan, main_id: mainId, main_delta_bytes: mainDelta,
        current_growth_floor_bytes: currentFloor, recent_activity_bytes: recentBytes,
        observed_received_bytes: s.total, decision_reason: reason, low_since_s: s.lowSince,
        recovery_used: s.recoveryUsed, hold_until_s: s.holdUntil,
        new_or_growing: newOrGrowing, recently_productive: recentBytes >= p.activity_bytes,
        retained_samples: rows.length, action: 'record_only'
      };
    }
    checkpoint() { return JSON.stringify({version: 1, parameters: this.p, state: this.s}); }
    restore(text) {
      // Checkpoints are local measurements, never configuration or executable input.
      const fail = () => { this.discardEvidence(); this.protect(); return false; };
      try {
        if (typeof text !== 'string' || text.length > 65536) return fail();
        const data = JSON.parse(text), x = data.state;
        if (data.version !== 1 || JSON.stringify(data.parameters) !== JSON.stringify(this.p) || !x ||
            Object.keys(x).sort().join() !== Object.keys(this.s).sort().join()) return fail();
        for (const k of ['origin','lastTime','quietSince','lowSince','holdUntil'])
          if (x[k] !== null && !finite(x[k])) return fail();
        for (const k of ['phaseAnchor','boundaryAnchor','protectionAt'])
          if (x[k] !== null && (!Number.isSafeInteger(x[k]) || x[k] < -1 || x[k] > x.index)) return fail();
        if (!Number.isSafeInteger(x.index) || x.index < -1 || !integer(x.total) ||
            !integer(x.resumedBytes) || x.resumedBytes > this.p.resume_bytes ||
            !integer(x.positiveReads) || x.positiveReads > 2 ||
            !['WAIT','SETTLING','DOWNLOAD','UNCERTAIN'].includes(x.state)) return fail();
        for (const k of ['emitted','protected','recoveryUsed']) if (typeof x[k] !== 'boolean') return fail();
        const validPairs = pairs => Array.isArray(pairs) && pairs.length <= this.p.max_target_ids &&
          pairs.every(r => Array.isArray(r) && r.length === 2 && integer(r[0]) && integer(r[1])) &&
          new Set(pairs.map(r => r[0])).size === pairs.length;
        if (!validPairs(x.previous) || !Array.isArray(x.rows) || x.rows.length > this.p.max_snapshots) return fail();
        for (let i = 0; i < x.rows.length; i++) {
          const r = x.rows[i], prev = x.rows[i-1];
          if (!r || Object.keys(r).sort().join() !== 'amount,changes,index,rel,time,total' ||
              !integer(r.index) || !finite(r.time) || !finite(r.rel) || !integer(r.total) ||
              !integer(r.amount) || !validPairs(r.changes) || r.total > x.total || r.index > x.index ||
              (prev && (r.time <= prev.time || r.index <= prev.index || r.total < prev.total)) ||
              r.rel !== r.time - x.origin) return fail();
        }
        const last = x.rows[x.rows.length-1];
        if (last && (last.time !== x.lastTime || last.total !== x.total || last.index !== x.index)) return fail();
        if (x.state === 'DOWNLOAD' && (!last || x.phaseAnchor === null || x.boundaryAnchor === null)) return fail();
        this.s = x;
        return true;
      } catch (_) { return fail(); }
    }
  }
  return {Detector, DEFAULTS};
}));

};
__factories["src/core/adapter"]=function(module,exports,require){
/* Strict mapping of the verified TV response, including opaque TLS authorities. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VidHubAdapter = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function value(object, path) {
    if (!Array.isArray(path) || path.length < 1 || path.length > 4 ||
        path.some(k => typeof k !== 'string' || ['__proto__','prototype','constructor'].includes(k)))
      throw new Error('invalid_schema_path');
    let out = object;
    for (const key of path) {
      if (!out || typeof out !== 'object' || !Object.prototype.hasOwnProperty.call(out, key))
        throw new Error('schema_field_missing');
      out = out[key];
    }
    return out;
  }
  function endpoint(text) {
    if (typeof text !== 'string' || text.length > 32768 || /[\\\s]/.test(text)) return null;
    // Narrow parser avoids unavailable WebView URL APIs. No userinfo or escaped host.
    // TV opaque TLS requests expose exactly host:port, without a URL scheme.
    // Accept only the complete authority in this form, never a path or userinfo.
    const match = /^https:\/\/([^/?#]+)(?:[/?#]|$)/i.exec(text) ||
      /^([a-z0-9.-]+:\d+)$/i.exec(text);
    if (!match || /[@%\[\]]/.test(match[1])) return null;
    const parts = match[1].split(':');
    if (parts.length > 2 || !/^[a-z0-9.-]+$/i.test(parts[0]) ||
        (parts.length === 2 && !/^\d+$/.test(parts[1]))) return null;
    const port = parts.length === 2 ? Number(parts[1]) : 443;
    return port >= 1 && port <= 65535 ? {host: parts[0].toLowerCase(), port} : null;
  }
  function create(schema) {
    if (!schema || schema.verified !== true) throw new Error('http_schema_unverified');
    const fields = ['id','url','inBytes','local','deviceName','completed','failed'];
    if (!schema.fields || fields.some(k => !Array.isArray(schema.fields[k])))
      throw new Error('http_schema_incomplete');
    return payload => {
      const rows = value(payload, schema.rowsPath);
      if (!Array.isArray(rows) || rows.length > 10000) throw new Error('unexpected_response_size_or_shape');
      const selected = [];
      for (const row of rows) {
        const dest = endpoint(value(row, schema.fields.url));
        if (!dest || dest.host !== __binding.host || dest.port !== 443) continue;
        const mapped = {host: dest.host, port: dest.port};
        for (const key of fields) if (key !== 'url') mapped[key] = value(row, schema.fields[key]);
        if (typeof mapped.local !== 'boolean' || typeof mapped.deviceName !== 'string' ||
            typeof mapped.completed !== 'boolean' || typeof mapped.failed !== 'boolean')
          throw new Error('invalid_identity_or_status');
        if (!mapped.local || mapped.deviceName !== __binding.deviceName || mapped.completed || mapped.failed) continue;
        if (!Number.isSafeInteger(mapped.id) || mapped.id < 0 ||
            !Number.isSafeInteger(mapped.inBytes) || mapped.inBytes < 0) throw new Error('invalid_counter');
        selected.push(mapped);
        if (selected.length > 8) throw new Error('target_capacity');
      }
      return selected;
    };
  }
  return {create, endpoint};
}));

};
__factories["src/core/runner"]=function(module,exports,require){
/* Finite read-only worker. Dependencies are injected; no Surge globals here. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./detector'));
  else root.VidHubRunner = factory(root.VidHubDetector);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
  'use strict';
  const bytes = s => {
    let n = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c < 128) n++;
      else if (c < 2048) n += 2;
      else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length &&
          s.charCodeAt(i+1) >= 0xDC00 && s.charCodeAt(i+1) <= 0xDFFF) { n += 4; i++; }
      else n += 3;
    }
    return n;
  };
  class Cadence {
    constructor(fastMs, idleMs, adaptive) {
      this.fastMs = fastMs; this.idleMs = idleMs; this.adaptive = adaptive;
      this.period = fastMs; this.fastUntil = null;
    }
    next(point, now) {
      if (!this.adaptive) return this.fastMs;
      if (this.fastUntil === null) this.fastUntil = now + 1000;
      if (this.period === this.idleMs && point.new_or_growing) this.fastUntil = now + 1000;
      this.period = point.state === 'DOWNLOAD' || point.state === 'SETTLING' ||
        point.recently_productive || now < this.fastUntil
        ? this.fastMs : this.idleMs;
      return this.period;
    }
  }
  function start(options) {
    const o = Object.assign({durationMs: 29700, fastMs: 100, idleMs: 1000,
      watchdogMs: 1000, adaptive: false, maxEvents: 64, scope: 'local-test'}, options);
    for (const k of ['now','schedule','read','save','done'])
      if (typeof o[k] !== 'function') throw new Error('missing_worker_dependency');
    for (const k of ['durationMs','fastMs','idleMs','watchdogMs','maxEvents'])
      if (!Number.isFinite(o[k]) || o[k] <= 0) throw new Error('invalid_worker_limit');
    if (o.durationMs > 29700 || o.fastMs < 50 || o.idleMs < o.fastMs ||
        o.watchdogMs > 1000 || o.maxEvents > 64 || !Number.isInteger(o.maxEvents) ||
        o.parameters && o.parameters.quarantine_unreliable_intervals === false)
      throw new Error('unsafe_worker_limit');
    const detector = new core.Detector(o.parameters), cadence = new Cadence(o.fastMs, o.idleMs, o.adaptive);
    const started = o.now(), deadline = started + o.durationMs;
    let ended = false, inFlight = false, token = 0, lastClock = started, previousState = null;
    const events = [];
    const stats = {reads: 0, samples: 0, candidates: 0, maxReadMs: 0,
      maxHistory: 0, maxInFlight: 0, checkpointWrites: 0, restored: false};
    if (o.checkpoint) {
      try {
        if (bytes(o.checkpoint) > 65536) throw new Error('checkpoint_too_large');
        const saved = JSON.parse(o.checkpoint);
        if (saved.version !== 1 || saved.scope !== o.scope || typeof saved.core !== 'string')
          throw new Error('checkpoint_scope');
        stats.restored = detector.restore(saved.core);
      } catch (_) { stats.restored = false; }
    }
    if (!stats.restored) { detector.discardEvidence(); detector.protect(); }
    function finish(reason, discard) {
      if (ended) return;
      ended = true; token++;
      if (discard) detector.discardEvidence();
      const snapshot = JSON.stringify({version: 1, scope: o.scope, core: detector.checkpoint(), events});
      let persisted = false;
      if (bytes(snapshot) <= 65536) {
        try { stats.checkpointWrites++; persisted = o.save(snapshot) === true; } catch (_) { /* local failure */ }
      }
      o.done(Object.assign({}, stats, {reason, persisted, checkpointBytes: bytes(snapshot)}));
    }
    function clockOK(now) {
      if (!Number.isFinite(now) || now < lastClock) { finish('clock_discontinuity', true); return false; }
      lastClock = now;
      if (now >= deadline) { finish('batch_complete', inFlight); return false; }
      return true;
    }
    function tick() {
      if (ended) return;
      const begin = o.now();
      if (!clockOK(begin)) return;
      if (inFlight) { finish('unexpected_overlap', true); return; }
      // A final short read may finish; the independent deadline drops late callbacks.
      // Reserving a full 250 ms here would create a >500 ms gap every 30 s at 10 Hz.
      if (deadline - begin < Math.min(100, o.fastMs)) { finish('batch_complete', false); return; }
      inFlight = true; stats.reads++; stats.maxInFlight = 1;
      const generation = ++token;
      let settled = false;
      o.schedule(() => {
        if (!ended && !settled && generation === token) finish('read_timeout', true);
      }, Math.min(o.watchdogMs, deadline - begin));
      try {
        o.read((error, targets) => {
          if (ended || settled || generation !== token) return;
          settled = true; inFlight = false;
          const end = o.now();
          if (!clockOK(end)) return;
          if (error) { finish('read_or_schema_error', true); return; }
          const point = detector.ingest({time_s: (begin + end) / 2000,
            read_ms: end - begin, targets});
          stats.samples++; stats.maxReadMs = Math.max(stats.maxReadMs, end - begin);
          stats.maxHistory = Math.max(stats.maxHistory, point.retained_samples || 0);
          if (point.candidate) stats.candidates++;
          if (previousState !== point.state || point.candidate ||
              point.decision_reason === 'start_one_recovery_observation') {
            events.push({at_s: point.elapsed_s === undefined ? null : point.elapsed_s,
              state: point.state, id: point.main_id === undefined ? null : point.main_id,
              candidate: point.candidate, reason: point.decision_reason,
              rate_Bps: point.phase_rate_Bps === undefined ? null : point.phase_rate_Bps});
            if (events.length > o.maxEvents) events.shift();
          }
          previousState = point.state;
          if (typeof o.onPoint === 'function') o.onPoint(point); // Local test harness only.
          if (point.needs_baseline) { finish('invalid_sample', true); return; }
          const interval = cadence.next(point, end);
          o.schedule(tick, Math.max(1, begin + interval - end));
        });
      } catch (_) { finish('read_callback_failure', true); }
    }
    o.schedule(() => finish('batch_complete', inFlight), o.durationMs);
    tick();
    return {stop: () => finish('stopped_observer_only', true)};
  }
  return {start, Cadence, byteLength: bytes};
}));

};
__factories["src/policy/retry-rearm-policy"]=function(module,exports,require){
// Offline candidate only. No controller, network, authorization or action I/O.
// A fixed window follows our own action. The original detector, successor
// identity check and final revalidation remain necessary for any real action.
'use strict';
const DEFAULTS=Object.freeze({observation_s:5,maximum_gap_s:.5,maximum_read_ms:250,slow_Bps:2000000});
const finite=n=>typeof n==='number' && Number.isFinite(n);
function uniqueMain(frame) {
  const rows=frame.targets.filter(x=>x && x.id===frame.point.main_id);
  if(rows.length!==1)return false;
  const r=rows[0];
  return Number.isSafeInteger(r.id) && r.id>=0 && finite(r.started) && r.started>0 &&
    Number.isSafeInteger(r.engine) && r.engine>=0;
}
class RetryRearm {
  constructor(options={}) {
    this.p=Object.assign({},DEFAULTS,options);
    if(Object.keys(this.p).some(k=>!(k in DEFAULTS)) ||
       Object.values(this.p).some(x=>!finite(x)||x<=0) || this.p.slow_Bps!==DEFAULTS.slow_Bps)
      throw Error('invalid_rearm_parameters');
    this.actionAt=null;this.lastClock=null;
  }
  afterAction(time_s) {
    if(!finite(time_s) || (this.lastClock!==null && time_s<this.lastClock))throw Error('invalid_action_time');
    this.actionAt=time_s;this.lastClock=time_s;
  }
  view(retry_allowed=false,reason='awaiting_fresh_measurement') {
    const elapsed=this.actionAt===null?null:Math.max(0,this.lastClock-this.actionAt);
    return {retry_allowed,reason,observation_s:this.p.observation_s,
      window_start_s:this.actionAt,window_end_s:this.actionAt===null?null:this.actionAt+this.p.observation_s,
      window_elapsed_s:elapsed,window_remaining_s:elapsed===null?0:Math.max(0,this.p.observation_s-elapsed),
      window_complete:elapsed===null || elapsed+1e-9>=this.p.observation_s};
  }
  ingest(frame) {
    if(!frame || !finite(frame.time_s) || !finite(frame.read_ms) || frame.read_ms<0 ||
       !frame.point || !Array.isArray(frame.targets))throw Error('invalid_rearm_frame');
    const time=frame.time_s,p=frame.point;
    const gap=this.lastClock!==null && (!(time>this.lastClock) || time-this.lastClock>this.p.maximum_gap_s);
    this.lastClock=this.lastClock===null?time:Math.max(this.lastClock,time);
    // Bad measurements block this decision but never extend the fixed deadline.
    if(gap || p.reliable_read!==true || frame.read_ms>this.p.maximum_read_ms)
      return this.view(false,'unreliable_current_measurement');
    if(!this.view().window_complete)return this.view(false,'fixed_reconnect_observation');
    // Expiry alone cannot qualify idle, near-zero or ambiguous traffic.
    if(p.state!=='DOWNLOAD' || p.protected!==false || frame.unique_main!==true || !uniqueMain(frame))
      return this.view(false,'no_eligible_download');
    return this.view(true,this.actionAt===null?'no_own_action_yet':'fixed_observation_complete');
  }
}
module.exports={RetryRearm,DEFAULTS};

};
__factories["src/policy/download-startup-policy"]=function(module,exports,require){
// Offline candidate only. Raw filtered counters and existing detector output in;
// an additional startup veto out. No network, timers, controller, or action I/O.
'use strict';
const DEFAULTS=Object.freeze({near_zero_Bps:40960,quiet_window_s:.4,quiet_confirm_s:.6,
  maximum_gap_s:.5,maximum_read_ms:250,max_targets:8,max_history:64});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function key(row){
  if(!row||!Number.isSafeInteger(row.id)||row.id<0||!finite(row.started)||row.started<=0||
    !Number.isSafeInteger(row.engine)||row.engine<0||!Number.isSafeInteger(row.inBytes)||row.inBytes<0)
    throw Error('invalid_target');
  return `${row.id}/${row.started}/${row.engine}`;
}
class DownloadStartup {
  constructor(options={}){
    this.p={...DEFAULTS,...options};
    // Deliberately no default duration: the local comparison must choose it.
    if(!finite(this.p.startup_s)||this.p.startup_s<=0||this.p.startup_s>10||
       Object.keys(options).some(k=>!(k in DEFAULTS)&&k!=='startup_s')||
       Object.values(this.p).some(v=>!finite(v)||v<=0)||
       this.p.near_zero_Bps>=2000000||
       !Number.isInteger(this.p.max_targets)||!Number.isInteger(this.p.max_history))throw Error('invalid_parameters');
    this.clock=null;this.previous=null;this.history=[];this.tracks=new Map();
    this.quietSince=null;this.waiting=false;this.waitOrigin=null;
    this.start=null;this.end=null;this.source=null;this.episode=0;this.awaitOwnSuccessor=false;
  }
  clearEvidence(){
    this.previous=null;this.history=[];this.tracks=new Map();
    this.quietSince=null;this.waiting=false;this.waitOrigin=null;
    // A missing read is not a new waiting period, and cannot extend a deadline.
  }
  afterAction(t){
    if(!finite(t)||(this.clock!==null&&t<this.clock))throw Error('invalid_action_time');
    this.clock=t;this.clearEvidence();this.start=null;this.end=null;this.source=null;
    this.awaitOwnSuccessor=true;
    // Existing RetryRearm owns the unchanged five seconds from command dispatch.
  }
  view(reliable,reason,extra={}){
    const remaining=this.end===null?0:Math.max(0,this.end-this.clock);
    return {startup_permits_retry:reliable&&!this.waiting&&remaining<=1e-9,
      reason:!reliable?reason:this.waiting?'confirmed_near_zero_wait':remaining>1e-9?'natural_download_startup':reason,
      waiting:this.waiting,episode:this.episode,start_s:this.start,end_s:this.end,
      source:this.source,remaining_s:remaining,awaiting_own_successor:this.awaitOwnSuccessor,...extra};
  }
  ingest(f){
    if(!f||!finite(f.time_s)||!finite(f.read_ms)||f.read_ms<0||!Array.isArray(f.targets)||!f.point)
      throw Error('invalid_frame');
    const t=f.time_s;
    if(this.clock!==null&&t<=this.clock){this.clearEvidence();return this.view(false,'non_increasing_clock');}
    this.clock=t;
    let current;
    try{
      if(f.targets.length>this.p.max_targets)throw Error();
      current=new Map(f.targets.map(r=>[key(r),r]));
      if(current.size!==f.targets.length)throw Error();
    }catch(_){this.clearEvidence();return this.view(false,'invalid_identity');}
    const prev=this.previous,dt=prev===null?null:t-prev.time;
    const reliable=f.point.reliable_read===true&&f.read_ms<=this.p.maximum_read_ms&&
      (prev===null||(dt>0&&dt<=this.p.maximum_gap_s&&prev.read_ms<=this.p.maximum_read_ms));
    const decreased=prev&&[...current].some(([k,r])=>prev.rows.has(k)&&r.inBytes<prev.rows.get(k).inBytes);
    if(!reliable||decreased){this.clearEvidence();return this.view(false,'unreliable_current_measurement');}
    let amount=0,unknownInitialBytes=false;
    const nextTracks=new Map();
    for(const [k,r] of current){
      const old=prev?.rows.get(k),oldTrack=this.tracks.get(k);
      const delta=old?r.inBytes-old.inBytes:0;
      const track=oldTrack?{...oldTrack}:{seen:t,seenWithBaseline:prev!==null,resumeAnchor:null};
      amount+=delta;
      if(!old&&r.inBytes>0)unknownInitialBytes=true;
      if(this.waiting&&delta>0&&dt>0&&delta/dt>this.p.near_zero_Bps&&track.resumeAnchor===null)
        track.resumeAnchor=prev.time;
      nextTracks.set(k,track);
    }
    this.tracks=nextTracks;this.previous={time:t,read_ms:f.read_ms,rows:current};
    if(prev===null||unknownInitialBytes){
      this.history=[{t,total:0}];this.quietSince=null;
      // New-ID initial bytes cannot establish quiet. An already observed wait
      // remains valid; the next fresh increment may confirm its new download.
      return this.view(false,'fresh_counter_baseline');
    }
    const total=(this.history.at(-1)?.total||0)+amount;
    this.history.push({t,total});
    while(this.history.length>1&&this.history[1].t<=t-this.p.quiet_window_s)this.history.shift();
    if(this.history.length>this.p.max_history){this.clearEvidence();return this.view(false,'history_capacity');}
    const span=t-this.history[0].t;
    const rate=span+1e-9>=this.p.quiet_window_s?(total-this.history[0].total)/span:null;
    const substantial=f.point.state==='DOWNLOAD'&&f.point.protected===false&&f.unique_main===true&&
      f.point.main_delta_bytes>0&&f.point.main_delta_bytes>=f.point.current_growth_floor_bytes;
    const mains=[...current].filter(([,r])=>r.id===f.point.main_id);
    if(this.awaitOwnSuccessor){
      if(substantial&&mains.length===1){this.awaitOwnSuccessor=false;this.quietSince=null;
        this.history=[{t,total:0}];return this.view(true,'own_successor_uses_existing_action_window',{own_successor_resumed:true});}
      return this.view(true,'awaiting_own_successor_existing_gate_applies');
    }
    let confirmedNow=false;
    if(rate!==null&&rate<=this.p.near_zero_Bps){
      if(this.quietSince===null)this.quietSince=t;
      if(!this.waiting&&t-this.quietSince+1e-9>=this.p.quiet_confirm_s){
        this.waiting=true;this.waitOrigin=this.quietSince;confirmedNow=true;
        for(const track of this.tracks.values())track.resumeAnchor=null;
      }
    }else this.quietSince=null;
    if(this.waiting&&substantial&&mains.length===1&&!confirmedNow){
      const track=this.tracks.get(mains[0][0]);
      // A new ID during the confirmed wait starts at first appearance, including
      // tiny early bytes. A reused ID starts at the bracket of substantive growth.
      const isNew=track.seenWithBaseline&&track.seen>=this.waitOrigin;
      const start=isNew?track.seen:track.resumeAnchor;
      if(start===null)return this.view(false,'resume_anchor_not_observed',{near_zero_rate_Bps:rate});
      this.start=start;this.end=start+this.p.startup_s;this.source=isNew?'new_connection_first_seen':'reused_connection_growth_bracket';
      this.waiting=false;this.waitOrigin=null;this.quietSince=null;this.episode++;
      return this.view(true,'natural_startup_complete',{episode_started:true,near_zero_rate_Bps:rate});
    }
    if(this.waiting&&rate!==null&&rate<=this.p.near_zero_Bps){
      // A tiny unrelated pulse long before real download must not consume a
      // reused connection's eventual startup window.
      for(const track of this.tracks.values())if(track.resumeAnchor!==null&&
        t-track.resumeAnchor>this.p.quiet_window_s+this.p.quiet_confirm_s)track.resumeAnchor=null;
    }
    return this.view(true,'no_new_startup_veto',{wait_confirmed_now:confirmedNow,near_zero_rate_Bps:rate});
  }
}
module.exports={DownloadStartup,DEFAULTS};

};
__factories["src/pipeline"]=function(module,exports,require){
'use strict';
// Pure TV decision pipeline. The executed historical modules remain unchanged.
const {Detector}=require('./core/detector');
const {create}=require('./core/adapter');
const {RetryRearm}=require('./policy/retry-rearm-policy');
const {DownloadStartup}=require('./policy/download-startup-policy');
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const POLICY=Object.freeze({startup_s:4,near_zero_Bps:40960,quiet_window_s:.4,quiet_confirm_s:.6});
function fingerprint(r){
  if(!r||!integer(r.id)||!integer(r.inBytes)||!finite(r.started)||r.started<=0||!integer(r.engine))
    throw Error('invalid_connection_identity');
  return `${r.id}/${r.started}/${r.engine}`;
}
function uniqueMain(d,p){
  if(p.main_id==null||!d.s.rows.length||d.s.phaseAnchor===null)return false;
  const rows=d.s.rows,now=rows.at(-1).time;let j=rows.length-1,a=0;
  while(j>0&&rows[j].time>now-d.p.speed_window_s)j--;
  while(a<rows.length-1&&rows[a].index<d.s.phaseAnchor)a++;
  j=Math.max(j,a);const present=new Set(d.s.previous.map(r=>r[0])),totals=new Map();
  for(const r of rows.slice(j+1))for(const [id,delta] of r.changes)
    if(present.has(id))totals.set(id,(totals.get(id)||0)+delta);
  const v=[...totals].sort((a,b)=>b[1]-a[1]);
  return v.length>0&&v[0][0]===p.main_id&&v[0][1]>0&&(v.length===1||v[0][1]>v[1][1]);
}
class MeasurementGate{
  constructor(){this.reset();}
  reset(){this.episode=null;this.recoveryUsed=false;this.holdUntil=null;}
  consider(f){
    const p=f.point;
    if(['WAIT','UNCERTAIN'].includes(p.state)||p.protected||p.phase_rate_Bps>=2e6)this.reset();
    if(p.state!=='DOWNLOAD'||p.protected!==false||p.reliable_read!==true||f.unique_main!==true||
      !finite(p.phase_rate_Bps)||!(p.phase_rate_Bps>0&&p.phase_rate_Bps<2e6)||
      p.low_since_s==null||p.elapsed_s-p.low_since_s<.4||
      (p.hold_until_s!=null&&p.elapsed_s<p.hold_until_s)||
      !finite(p.main_delta_bytes)||!finite(p.current_growth_floor_bytes)||
      !(p.main_delta_bytes>0&&p.main_delta_bytes>=p.current_growth_floor_bytes)||
      !['productive_low_speed_candidate','already_recorded_this_episode'].includes(p.decision_reason))
      return {row:null,reason:'fresh_main_not_eligible'};
    const rows=f.targets.filter(r=>r.id===p.main_id);
    if(rows.length!==1)return {row:null,reason:'main_not_unique_in_response'};
    const row=rows[0],ep=fingerprint(row)+'/'+p.low_since_s;
    if(ep!==this.episode){this.reset();this.episode=ep;}
    if(p.recovery_used)this.recoveryUsed=true;
    if(this.holdUntil!==null&&f.time_s<this.holdUntil)return {row:null,reason:'bounded_executor_recovery_observation'};
    if(!this.recoveryUsed&&p.short_rate_Bps>=2e6){
      this.recoveryUsed=true;this.holdUntil=f.time_s+.4;
      return {row:null,reason:'start_executor_recovery_observation'};
    }
    return {row,reason:'eligible_fresh_measurement'};
  }
}
class Replacement{
  constructor(action){
    this.old=fingerprint(action.connection);this.known=new Set(action.pre_action_targets.map(fingerprint));
    this.previous=null;this.absent=0;this.growing=new Set();
  }
  observe(f){
    const current=new Map(f.targets.map(r=>[fingerprint(r),r.inBytes]));
    let valid=f.point.reliable_read===true&&f.read_ms<=250;
    if(this.previous){
      const before=new Map(this.previous.targets.map(r=>[fingerprint(r),r.inBytes]));
      const span=f.time_s-this.previous.time_s;
      valid=valid&&span>0&&span<=.5&&this.previous.read_ms<=250&&
        [...current].every(([k,v])=>!before.has(k)||v>=before.get(k));
      if(valid)for(const [k,v] of current)
        if(before.has(k)&&!this.known.has(k)&&v>before.get(k))this.growing.add(k);
    }
    this.absent=valid&&!current.has(this.old)?Math.min(2,this.absent+1):0;this.previous=f;
  }
  allows(row){const fp=fingerprint(row);return this.absent>=2&&!this.known.has(fp)&&this.growing.has(fp);}
}
class Pipeline{
  constructor(){
    const fields=Object.fromEntries(['id','inBytes','local','deviceName','completed','failed'].map(k=>[k,[k]]));
    fields.url=['URL'];this.adapt=create({verified:true,rowsPath:['requests'],fields});
    this.detector=new Detector();this.detector.protect();this.gate=new MeasurementGate();
    this.own=new RetryRearm({observation_s:5});this.startup=new DownloadStartup(POLICY);
    this.replacement=null;this.seen=new Map();this.lastTime=null;
  }
  ingest(payload,beginMs,endMs,expectedEngine){
    if(!finite(beginMs)||!finite(endMs)||endMs<beginMs)throw Error('invalid_read_clock');
    const mapped=this.adapt(payload),targets=mapped.map(r=>{
      const matches=payload.requests.filter(x=>x.id===r.id);
      if(matches.length!==1)throw Error('ambiguous_identity');
      const raw=matches[0],row={id:r.id,inBytes:r.inBytes,started:raw.startDate,engine:raw.engineIdentifier};
      const fp=fingerprint(row);
      if(expectedEngine!==undefined&&row.engine!==expectedEngine)throw Error('engine_changed');
      if(this.seen.has(row.id)&&this.seen.get(row.id)!==fp)throw Error('reused_connection_identity');
      this.seen.set(row.id,fp);if(this.seen.size>256)throw Error('identity_history_capacity');
      return row;
    });
    const time_s=(beginMs+endMs)/2000,read_ms=endMs-beginMs;
    if(this.lastTime!==null&&time_s<=this.lastTime)throw Error('non_increasing_clock');
    this.lastTime=time_s;
    const point=this.detector.ingest({time_s,read_ms,targets:mapped});
    if(point.needs_baseline)throw Error('invalid_core_sample');
    const frame={time_s,read_ms,received_ms:endMs,point,targets,unique_main:uniqueMain(this.detector,point)};
    frame.rearm=this.own.ingest(frame);frame.startup=this.startup.ingest(frame);
    if(this.replacement)this.replacement.observe(frame);
    return frame;
  }
  consider(frame){
    const decision=this.gate.consider(frame);
    if(!decision.row)return decision;
    if(!frame.rearm.retry_allowed)return {row:null,reason:frame.rearm.reason};
    if(!frame.startup.startup_permits_retry)return {row:null,reason:frame.startup.reason};
    if(this.replacement&&!this.replacement.allows(decision.row))return {row:null,reason:'replacement_not_confirmed'};
    return decision;
  }
  revalidate(first,last,nowMs){
    const d=this.consider(last);if(!d.row)return d;
    if(fingerprint(first.row)!==fingerprint(d.row)||d.row.inBytes<=first.row.inBytes)
      return {row:null,reason:'identity_changed_or_no_new_growth'};
    if(!finite(nowMs)||nowMs-last.received_ms<0||nowMs-last.received_ms>250)
      return {row:null,reason:'stale_before_dispatch'};
    return d;
  }
  afterAction(action,timeMs){
    this.detector.discardEvidence();this.detector.protect();this.gate.reset();
    this.own.afterAction(timeMs/1000);this.startup.afterAction(timeMs/1000);
    this.replacement=new Replacement(action);
  }
  audit(){
    // Informational only. This trial cannot be resumed after a crash or rerun.
    return {core:this.detector.checkpoint(),own:this.own.view(),
      startup:this.startup.view(false,'audit_only'),measurement:{episode:this.gate.episode,
      recoveryUsed:this.gate.recoveryUsed,holdUntil:this.gate.holdUntil},
      replacement:this.replacement?{old:this.replacement.old,absent:this.replacement.absent,
        known:[...this.replacement.known],growing:[...this.replacement.growing]}:null};
  }
}
module.exports={Pipeline,MeasurementGate,Replacement,POLICY,fingerprint};

};
__factories["src/autonomous/ownership"]=function(module,exports,require){
'use strict';
// One-shot splitter, NOT a reusable read/write lease. Each generation uses new
// registers, never reopened/deleted by a running worker. The at-most-one-winner
// proof requires individually atomic, coherent read/write registers; Surge's
// cross-JSC store semantics must still be qualified on the actual TV.
const PREFIX='vidhub-autonomous-v1';
const HEAD=PREFIX+'-head';
const key=(g,s)=>PREFIX+'-g'+g+'-'+s;
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const identity=x=>typeof x==='string'&&/^[A-Za-z0-9-]{1,80}$/.test(x);
function* splitter(g,id){
  if(!integer(g)||g>100000||!identity(id))throw Error('invalid_owner_identity');
  yield {op:'write',key:key(g,'race'),value:id};
  const door=yield {op:'read',key:key(g,'door')};
  if(door!==null)return false;
  yield {op:'write',key:key(g,'door'),value:'closed'};
  return (yield {op:'read',key:key(g,'race')})===id;
}
function claim(store,g,id){
  const it=splitter(g,id);let step=it.next();
  while(!step.done){
    const q=step.value;let v;
    if(q.op==='write'){
      if(store.write(q.key,q.value)!==true)throw Error('ownership_write_failed');
    }else v=store.read(q.key);
    step=it.next(v);
  }
  return step.value;
}
function parse(raw,max=524288){
  if(typeof raw!=='string'||raw.length>max)throw Error('invalid_saved_state');
  const x=JSON.parse(raw);
  if(!x||typeof x!=='object'||Array.isArray(x))throw Error('invalid_saved_state');
  return x;
}
function head(store){
  const raw=store.read(HEAD);if(raw===null)return {raw:null,value:null,state:null};
  const h=parse(raw,2048);
  if(Object.keys(h).sort().join()!=='codeId,generation,runId,sessionId,version'||h.version!==1||
    !integer(h.generation)||h.generation>100000||!identity(h.sessionId)||!identity(h.runId)||
    typeof h.codeId!=='string'||!/^[a-f0-9]{64}$/.test(h.codeId))throw Error('invalid_head');
  const s=parse(store.read(key(h.generation,'state')));
  if(s.generation!==h.generation||s.sessionId!==h.sessionId||s.runId!==h.runId||s.codeId!==h.codeId||
    typeof s.closed!=='boolean'||typeof s.terminal!=='boolean')throw Error('head_state_mismatch');
  return {raw,value:h,state:s};
}
function begin(store,parent,runId,sessionId,codeId,makeState){
  const generation=parent.value?parent.value.generation+1:0;
  if(parent.state&&(!parent.state.closed||(!parent.state.terminal&&parent.state.runId!==runId)))
    return {accepted:false,reason:'previous_worker_not_closed'};
  if(!claim(store,generation,sessionId))return {accepted:false,reason:'splitter_not_won'};
  if(store.read(HEAD)!==parent.raw)throw Error('parent_changed_during_claim');
  const h={version:1,generation,runId,sessionId,codeId};
  const s=makeState(h);const raw=JSON.stringify(s),header=JSON.stringify(h);
  if(raw.length>524288||store.write(key(generation,'state'),raw)!==true||
    store.read(key(generation,'state'))!==raw)throw Error('initial_state_write_failed');
  if(store.write(HEAD,header)!==true||store.read(HEAD)!==header)throw Error('head_write_failed');
  return {accepted:true,header,state:s};
}
module.exports={PREFIX,HEAD,key,splitter,claim,parse,head,begin};

};
__factories["src/autonomous/snapshot"]=function(module,exports,require){
'use strict';
const {Pipeline,Replacement}=require('../pipeline');
const copy=x=>JSON.parse(JSON.stringify(x));
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const times=(x,keys)=>keys.every(k=>x[k]===null||finite(x[k]));
function exact(x,keys){
  if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).sort().join()!==keys.slice().sort().join())
    throw Error('snapshot_shape');
}
function pairs(x,limit){
  if(!Array.isArray(x)||x.length>limit||x.some(r=>!Array.isArray(r)||r.length!==2)||
    new Set(x.map(r=>r[0])).size!==x.length)throw Error('snapshot_pairs');
  return x;
}
function inspectJSON(x,depth=0){
  if(depth>15)throw Error('snapshot_depth');
  if(x===null||typeof x==='boolean')return;
  if(typeof x==='number'){if(!finite(x))throw Error('snapshot_number');return;}
  if(typeof x==='string'){if(x.length>65536)throw Error('snapshot_string');return;}
  if(!x||typeof x!=='object')throw Error('snapshot_value');
  if(Object.keys(x).length>512)throw Error('snapshot_capacity');
  for(const k of Object.keys(x)){
    if(['__proto__','constructor','prototype'].includes(k))throw Error('snapshot_key');
    inspectJSON(x[k],depth+1);
  }
}
function capture(p){
  const s=p.startup;
  return copy({version:1,core:p.detector.checkpoint(),own:{actionAt:p.own.actionAt,lastClock:p.own.lastClock},
    startup:{clock:s.clock,previous:s.previous?{...s.previous,rows:[...s.previous.rows]}:null,
      history:s.history,tracks:[...s.tracks],quietSince:s.quietSince,waiting:s.waiting,waitOrigin:s.waitOrigin,
      start:s.start,end:s.end,source:s.source,episode:s.episode,awaitOwnSuccessor:s.awaitOwnSuccessor},
    gate:{episode:p.gate.episode,recoveryUsed:p.gate.recoveryUsed,holdUntil:p.gate.holdUntil},
    replacement:p.replacement?{old:p.replacement.old,known:[...p.replacement.known],growing:[...p.replacement.growing],
      absent:p.replacement.absent,previous:p.replacement.previous}:null,seen:[...p.seen],lastTime:p.lastTime});
}
function restore(x){
  if(JSON.stringify(x).length>196608)throw Error('snapshot_capacity');inspectJSON(x);
  exact(x,['version','core','own','startup','gate','replacement','seen','lastTime']);
  if(x.version!==1||!(x.lastTime===null||finite(x.lastTime)))throw Error('snapshot_version');
  const p=new Pipeline();if(!p.detector.restore(x.core))throw Error('snapshot_core');
  exact(x.own,['actionAt','lastClock']);if(!times(x.own,['actionAt','lastClock'])||
    (x.own.actionAt!==null&&(x.own.lastClock===null||x.own.actionAt>x.own.lastClock)))throw Error('snapshot_own');
  Object.assign(p.own,x.own);
  const s=x.startup;
  exact(s,['clock','previous','history','tracks','quietSince','waiting','waitOrigin','start','end','source','episode','awaitOwnSuccessor']);
  if(!times(s,['clock','quietSince','waitOrigin','start','end'])||!integer(s.episode)||
    typeof s.waiting!=='boolean'||typeof s.awaitOwnSuccessor!=='boolean'||
    ![null,'new_connection_first_seen','reused_connection_growth_bracket'].includes(s.source)||
    ((s.start===null)!==(s.end===null))||(s.start!==null&&Math.abs(s.end-s.start-4)>1e-6)||
    !Array.isArray(s.history)||s.history.length>64)throw Error('snapshot_startup');
  for(const r of s.history){exact(r,['t','total']);if(!finite(r.t)||!integer(r.total))throw Error('snapshot_history');}
  const tracks=pairs(s.tracks,8);
  for(const [k,r] of tracks){exact(r,['seen','seenWithBaseline','resumeAnchor']);
    if(typeof k!=='string'||!finite(r.seen)||typeof r.seenWithBaseline!=='boolean'||
      !(r.resumeAnchor===null||finite(r.resumeAnchor)))throw Error('snapshot_tracks');}
  let previous=null;
  if(s.previous){exact(s.previous,['time','read_ms','rows']);
    if(!finite(s.previous.time)||!finite(s.previous.read_ms)||s.previous.read_ms<0)throw Error('snapshot_previous');
    const rows=pairs(s.previous.rows,8);
    for(const [k,r] of rows)if(typeof k!=='string'||!r||!integer(r.id)||!integer(r.inBytes)||
      !finite(r.started)||!integer(r.engine))throw Error('snapshot_previous');
    previous={...s.previous,rows:new Map(rows)};}
  Object.assign(p.startup,copy(s),{previous,tracks:new Map(tracks)});
  exact(x.gate,['episode','recoveryUsed','holdUntil']);
  if(!(x.gate.episode===null||typeof x.gate.episode==='string')||typeof x.gate.recoveryUsed!=='boolean'||
    !(x.gate.holdUntil===null||finite(x.gate.holdUntil)))throw Error('snapshot_gate');
  Object.assign(p.gate,x.gate);
  const seen=pairs(x.seen,256);
  if(seen.some(([id,fp])=>!integer(id)||typeof fp!=='string'))throw Error('snapshot_seen');
  p.seen=new Map(seen);p.lastTime=x.lastTime;
  if(x.replacement){const r=x.replacement;exact(r,['old','known','growing','absent','previous']);
    if(typeof r.old!=='string'||!integer(r.absent)||r.absent>2||
      !Array.isArray(r.known)||!Array.isArray(r.growing)||r.known.length>8||r.growing.length>256||
      [...r.known,...r.growing].some(k=>typeof k!=='string'))throw Error('snapshot_replacement');
    p.replacement=Object.assign(Object.create(Replacement.prototype),copy(r),{known:new Set(r.known),growing:new Set(r.growing)});
  }
  // No artificial handoff reset. The original ingest functions detect a gap
  // above 0.5 s and quarantine evidence, while fixed action/startup deadlines stay.
  return p;
}
module.exports={capture,restore,inspectJSON};

};
__factories["src/autonomous/runtime"]=function(module,exports,require){
'use strict';
const {Pipeline,fingerprint}=require('../pipeline');
const {endpoint}=require('../core/adapter');
const {byteLength}=require('../core/runner');
const ownership=require('./ownership');
const snapshots=require('./snapshot');
const PERIOD=120000,RESERVE=300,MAX_STATE=524288;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const copy=x=>JSON.parse(JSON.stringify(x));
function validate(b){
  const keys=['enabled','runId','mode','host','deviceName','expectedBuild','expectedModel','notBeforeMs',
    'latestStartMs','expiresMs','durationMs','referenceMs','tailMs','maxAttempts','diagnostic'];
  if(b&&Object.prototype.hasOwnProperty.call(b,'waitTargetMs'))keys.push('waitTargetMs');
  if(!b||Object.keys(b).sort().join()!==keys.sort().join()||b.enabled!==true||
    !/^[a-z0-9-]{16,80}$/.test(b.runId)||!['observe','execute','diagnostic'].includes(b.mode)||
    typeof b.host!=='string'||!b.host.split('.').every(x=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(x))||
    b.host.length>253||b.host.indexOf('.')<1||typeof b.deviceName!=='string'||b.deviceName.length<1||b.deviceName.length>64||
    typeof b.expectedBuild!=='string'||!/^\d{1,10}$/.test(b.expectedBuild)||
    typeof b.expectedModel!=='string'||b.expectedModel.length>64||!b.expectedModel.length||
    !['notBeforeMs','latestStartMs','expiresMs','durationMs','referenceMs','tailMs','maxAttempts'].every(k=>integer(b[k]))||
    b.latestStartMs<=b.notBeforeMs||b.latestStartMs-b.notBeforeMs>300000||
    b.expiresMs<=b.latestStartMs||b.expiresMs-b.notBeforeMs>1200000||
    b.durationMs<5000||b.durationMs>900000||b.referenceMs+b.tailMs>=b.durationMs||
    b.maxAttempts>30||(b.mode==='observe'&&b.maxAttempts!==0)||(b.mode==='execute'&&b.maxAttempts<1)||
    ('waitTargetMs' in b&&(!integer(b.waitTargetMs)||b.waitTargetMs<1000||b.waitTargetMs>300000)))
    throw Error('invalid_configuration');
  if(b.mode==='diagnostic'){
    const d=b.diagnostic;
    if(b.maxAttempts!==1||b.durationMs>60000||!d||Object.keys(d).sort().join()!=='engine,id,started'||
      !integer(d.id)||!integer(d.engine)||!finite(d.started)||d.started<=0)throw Error('invalid_diagnostic_scope');
  }else if(b.diagnostic!==null)throw Error('diagnostic_not_allowed');
  return b;
}
function compact(f){const p=f.point;return [Math.round(f.time_s*1000),f.read_ms,p.main_id,p.phase_rate_Bps,
  p.short_rate_Bps,p.main_delta_bytes,p.state,p.protected,f.startup.remaining_s,f.rearm.window_remaining_s,
  f.targets.map(r=>[r.id,r.inBytes])];}
function validateHandoff(s,b){
  if(s.version!==1||!['samples','candidates','eligible','attemptsReserved','invocations','sessions'].every(k=>integer(s[k]))||
    s.attemptsReserved>b.maxAttempts||s.invocations>s.attemptsReserved||!Array.isArray(s.actions)||
    s.actions.length!==s.attemptsReserved||!Array.isArray(s.recent)||s.recent.length>64||
    !Array.isArray(s.events)||s.events.length>96||!Array.isArray(s.sessionHistory)||s.sessionHistory.length!==s.sessions||
    !integer(s.runStartedMs)||!integer(s.updatedMs)||s.updatedMs<s.runStartedMs||
    !(s.originMs===null||integer(s.originMs))||!(s.actionsDisabled===null||s.actionsDisabled==='operator_observe'))
    throw Error('invalid_handoff_ledger');
  let last=null;
  for(let i=0;i<s.actions.length;i++){
    const a=s.actions[i];
    if(a.sequence!==i+1||!integer(a.startedMs)||!integer(a.completedMs)||a.completedMs<a.startedMs||
      a.completedMs>s.updatedMs||a.status!=='reply_received_effect_unverified'||
      (last!==null&&a.startedMs-last<5000))throw Error('unsafe_handoff_action');
    last=a.startedMs;
  }
  if(s.invocations!==s.actions.length||s.pipeline?.own?.actionAt!==(last===null?null:last/1000))
    throw Error('handoff_action_clock_mismatch');
}
function start(o){
  const b=o.binding;let ended=false,owned=null,state=null,pipeline=null,pending=null,token=0,lastClock=null;
  const done=(reason,extra={})=>o.done({reason,...extra});
  if(!b||b.enabled!==true){done('disabled');return;}
  validate(b);
  if(b.mode!=='observe'&&o.capabilities?.actionsQualified!==true){done('active_build_not_qualified');return;}
  if(!/^[A-Za-z0-9-]{1,80}$/.test(o.sessionId)||!/^[a-f0-9]{64}$/.test(o.codeId))throw Error('invalid_runtime_identity');
  const binding=JSON.stringify(b),store={read:o.readStore,write:(k,v)=>o.writeStore(v,k)};
  const flags={stop:ownership.PREFIX+'-'+b.runId+'-stop',observe:ownership.PREFIX+'-'+b.runId+'-observe'};
  function now(){const t=o.now();if(!integer(t)||(lastClock!==null&&t<lastClock))throw Error('clock_discontinuity');
    lastClock=t;return t;}
  const begin=now();if(begin<b.notBeforeMs||begin>=b.expiresMs){done('outside_run_window');return;}
  const parent=ownership.head(store),same=parent.state?.runId===b.runId;
  const runKey=ownership.PREFIX+'-'+b.runId+'-root';
  if(!same&&store.read(runKey)!==null){done('run_cannot_be_reused');return;}
  if(same&&(parent.state.binding!==binding||parent.state.codeId!==o.codeId)){done('configuration_changed');return;}
  if(same&&parent.state.terminal){done('run_already_closed');return;}
  if(!same&&begin>b.latestStartMs){done('first_start_expired');return;}
  if(parent.state&&(!parent.state.closed||(!same&&!parent.state.terminal))){done('previous_worker_not_closed');return;}
  if(!same&&store.read(flags.stop)!==null){done('stop_flag');return;}
  if(same&&parent.state.reason!=='normal_yield'){done('unsafe_handoff');return;}
  if(same){
    if(parent.state.sessions>=16||begin<parent.state.updatedMs){done('handoff_limit_or_clock');return;}
    validateHandoff(parent.state,b);
    pipeline=snapshots.restore(parent.state.pipeline);
  }else pipeline=new Pipeline();
  const sessionStart=begin,sessionDeadline=Math.min(b.expiresMs,Math.floor(begin/PERIOD)*PERIOD+PERIOD-RESERVE);
  if(sessionDeadline-begin<1000){done('insufficient_session_budget');return;}
  const claim=ownership.begin(store,parent,b.runId,o.sessionId,o.codeId,h=>{
    if(!same){
      if(store.read(runKey)!==null||store.write(runKey,JSON.stringify(h))!==true)
        throw Error('run_root_write_failed');
    }
    const fresh={version:1,binding,runStartedMs:begin,originMs:null,sessions:0,sessionHistory:[],samples:0,
      candidates:0,eligible:0,attemptsReserved:0,invocations:0,actions:[],events:[],recent:[],gateReasons:{},
      states:{},maxReadMs:0,maxIntervalMs:0,lastSampleMs:null,streamId:null,actionsDisabled:null};
    const s=same?copy(parent.state):fresh;
    return {...s,...h,closed:false,terminal:false,reason:null,updatedMs:begin,sessionStartedMs:begin,
      sessions:s.sessions+1,phase:'starting',pipeline:snapshots.capture(pipeline)};
  });
  if(!claim.accepted){done(claim.reason);return;}
  owned=claim.header;state=claim.state;
  let nextCheckpoint=begin+30000,signalCheck=null,cachedStop=null,cachedObserve=null,lastFrame=null;
  function event(type,fields={}){state.events.push({atMs:now(),type,...fields});if(state.events.length>96)state.events.shift();}
  function signals(force=false){
    const t=now();if(force||signalCheck===null||t-signalCheck>=1000){
      cachedStop=store.read(flags.stop);cachedObserve=store.read(flags.observe);signalCheck=t;}
    if(cachedObserve!==null)state.actionsDisabled='operator_observe';
    return cachedStop!==null;
  }
  function persist(){
    if(store.read(ownership.HEAD)!==owned)throw Error('ownership_changed');
    state.pipeline=snapshots.capture(pipeline);state.updatedMs=now();
    const raw=JSON.stringify(state);if(byteLength(raw)>MAX_STATE)throw Error('evidence_capacity');
    const k=ownership.key(state.generation,'state');
    if(store.write(k,raw)!==true||store.read(k)!==raw)throw Error('state_write_failed');
  }
  function finish(reason,handoff=false){
    if(ended)return;ended=true;token++;pending=null;
    state.closed=true;state.terminal=!handoff;state.reason=reason;state.phase=handoff?'handoff':'ended';
    state.endedMs=o.now();state.sessionHistory.push({sessionId:o.sessionId,start:sessionStart,end:state.endedMs,reason});
    state.events.push({atMs:state.endedMs,type:'session_closed',reason});if(state.events.length>96)state.events.shift();let saved=false;
    try{persist();saved=true;}catch(_){/* Incomplete ownership remains blocked. Never reset the splitter. */}
    done(reason,{saved,closed:true,terminal:state.terminal,samples:state.samples,invocations:state.invocations});
  }
  function guard(fn){if(ended)return;try{fn();}catch(e){finish(e&&/^[a-z_]{1,80}$/.test(e.message)?e.message:'runtime_error');}}
  function later(fn,delay){o.schedule(()=>guard(fn),Math.max(1,delay));}
  function phase(t){
    if(state.originMs===null)return 'awaiting_download';
    const elapsed=t-state.originMs;return elapsed<b.referenceMs?'reference':elapsed<b.durationMs-b.tailMs?'actions':
      elapsed<b.durationMs?'tail':'ended';
  }
  function mayAct(t,reserved=false){const stopped=signals(true);return !stopped&&!ended&&o.capabilities?.actionsQualified===true&&b.mode!=='observe'&&
    !state.actionsDisabled&&(reserved?state.attemptsReserved<=b.maxAttempts:state.attemptsReserved<b.maxAttempts)&&phase(t)==='actions'&&
    t<b.expiresMs&&t<sessionDeadline&&store.read(ownership.HEAD)===owned;}
  function record(f){
    const row=compact(f);state.recent.push(row);if(state.recent.length>64)state.recent.shift();
    const a=state.actions.at(-1),replacement=pipeline.replacement;
    if(a&&a.startedMs!==null&&replacement){
      if(a.effectConfirmedMs===null&&replacement.absent>=2&&replacement.growing.size>0){
        a.effectConfirmedMs=f.received_ms;a.successors=[...replacement.growing];event('replacement_observed',{sequence:a.sequence});}
      const main=f.targets.find(r=>r.id===f.point.main_id);
      if(a.firstThresholdMs===null&&main&&replacement.allows(main)&&f.point.reliable_read&&f.point.phase_rate_Bps>=2000000)
        a.firstThresholdMs=f.received_ms;
    }
    for(const a of state.actions){
      if(a.startedMs===null||row[0]<=a.startedMs||row[0]-a.startedMs>20000||
        (a.followupEndMs!==null&&row[0]>=a.followupEndMs))continue;
      if(a.followup.length<102&&(!a.followup.length||row[0]-a.followup.at(-1)[0]>=190))a.followup.push(row);
    }
  }
  function diagnostic(f){
    const d=b.diagnostic,p=f.point,r=f.targets.find(r=>r.id===d.id&&r.started===d.started&&r.engine===d.engine);
    if(!r||p.main_id!==r.id||!f.unique_main||p.reliable_read!==true||p.protected||p.state!=='DOWNLOAD'||
      !(p.main_delta_bytes>0&&p.main_delta_bytes>=p.current_growth_floor_bytes)||
      !f.startup.startup_permits_retry||!f.rearm.retry_allowed)return {row:null,reason:'diagnostic_waiting_exact_active_main'};
    return {row:r,reason:'explicit_single_diagnostic_not_low_speed'};
  }
  function action(f,d){
    if(!mayAct(now()))return false;
    const before=[];for(const r of state.recent)if(!before.length||r[0]-before.at(-1)[0]>=190)before.push(r);
    const a={sequence:state.attemptsReserved+1,connection:{...d.row},pre_action_targets:f.targets,
      reservedMs:now(),startedMs:null,completedMs:null,status:'reserved_unknown',kind:b.mode,
      decision:{point:f.point,startup:f.startup,rearm:f.rearm,reason:d.reason},before:before.slice(-33),
      followup:[],followupEndMs:null,effectConfirmedMs:null,firstThresholdMs:null,successors:[]};
    state.actions.push(a);state.attemptsReserved++;event('action_reserved',{sequence:a.sequence});persist();
    let t=now();const allowed=mayAct(t,true);t=now();
    if(!allowed||t>=sessionDeadline||t>=b.expiresMs||t-f.received_ms<0||t-f.received_ms>250){finish('reserved_dispatch_cancelled');return true;}
    const prev=state.actions.at(-2);if(prev)prev.followupEndMs=t;
    a.startedMs=t;state.invocations++;pipeline.afterAction(a,t);pending=null;
    const generation=++token;let replied=false;
    later(()=>{if(!replied&&generation===token)finish('kill_result_unknown_no_retry');},1000);
    try{o.api('POST','/v1/requests/kill',{id:d.row.id},reply=>guard(()=>{
      if(replied||generation!==token)return;replied=true;a.completedMs=now();
      if(!reply||typeof reply!=='object'||Array.isArray(reply)||reply.error){finish('kill_reply_unknown_no_retry');return;}
      a.status='reply_received_effect_unverified';event('kill_reply',{sequence:a.sequence});persist();later(tick,100);
    }));}catch(_){finish('kill_exception_unknown_no_retry');}
    return true;
  }
  function tick(){
    const t=now();if(store.read(ownership.HEAD)!==owned){finish('ownership_changed');return;}
    if(signals()){finish('operator_stop');return;}
    if(t>=b.expiresMs||phase(t)==='ended'){finish('trial_complete');return;}
    if(state.originMs===null&&t-state.runStartedMs>=(b.waitTargetMs??120000)){finish('no_target_within_wait_budget');return;}
    if(t>=sessionDeadline){finish('normal_yield',true);return;}
    const generation=++token;let replied=false;
    later(()=>{if(!replied&&generation===token)finish('read_timeout');},1000);
    o.api('GET','/v1/requests/active',null,payload=>guard(()=>{
      if(replied||generation!==token)return;replied=true;const end=now();
      if(end>=b.expiresMs||phase(end)==='ended'){finish('trial_complete');return;}
      if(end>=sessionDeadline){finish('normal_yield',true);return;}
      if(!payload||!Array.isArray(payload.requests))throw Error('invalid_requests_shape');
      const relevant=payload.requests.filter(r=>{const dest=endpoint(r.URL);return dest&&dest.host===b.host&&dest.port===443&&
        r.local===true&&r.deviceName===b.deviceName&&r.completed===false&&r.failed===false;});
      if(relevant.some(r=>!['TCP','HTTPS'].includes(r.method)))throw Error('unexpected_target_transport');
      if(state.streamId===null&&relevant.length){const ids=new Set(relevant.map(r=>r.engineIdentifier));
        if(ids.size!==1||![...ids].every(integer))throw Error('ambiguous_stream_identity');state.streamId=[...ids][0];}
      const f=pipeline.ingest(payload,t,end,state.streamId===null?undefined:state.streamId);lastFrame=f;
      state.samples++;state.maxReadMs=Math.max(state.maxReadMs,f.read_ms);
      if(state.lastSampleMs!==null)state.maxIntervalMs=Math.max(state.maxIntervalMs,f.time_s*1000-state.lastSampleMs);
      state.lastSampleMs=f.time_s*1000;state.states[f.point.state]=(state.states[f.point.state]||0)+1;
      if(f.point.candidate)state.candidates++;
      if(state.originMs===null&&f.point.reliable_read&&f.point.recently_productive){state.originMs=end;event('download_origin');}
      state.phase=phase(end);record(f);
      const d=b.mode==='diagnostic'?diagnostic(f):pipeline.consider(f);
      state.gateReasons[d.reason]=(state.gateReasons[d.reason]||0)+1;if(d.row)state.eligible++;
      if(d.row&&mayAct(end)){
        if(pending){
          const fresh=b.mode==='diagnostic'?(fingerprint(pending.row)===fingerprint(d.row)&&d.row.inBytes>pending.row.inBytes?
            d:{row:null}):pipeline.revalidate(pending,f,now());pending=null;
          if(fresh.row&&action(f,fresh))return;
        }else pending={row:d.row,receivedMs:end};
      }else pending=null;
      if(end>=nextCheckpoint){persist();nextCheckpoint=end+30000;}
      // Only absence of all target connections lowers frequency. Buffered WAIT
      // with a target retains 100 ms sampling and unchanged startup semantics.
      const period=f.targets.length?100:1000;
      later(tick,Math.min(Math.max(1,t+period-now()),Math.max(1,sessionDeadline-now())));
    }));
  }
  guard(()=>{event('session_started',{generation:state.generation});persist();tick();});
  return {inspect:()=>copy(state),lastFrame:()=>lastFrame,stop:()=>finish('local_stop')};
}
module.exports={start,validate,validateHandoff,compact,PERIOD,RESERVE};

};
__factories["src/autonomous/jobs"]=function(module,exports,require){
// Job protocol v2 extension: bounded execute tasks require an independently qualified build.
'use strict';
const owner=require('./ownership');
const PERIOD=120000;
const copy=x=>JSON.parse(JSON.stringify(x));
const canonical=x=>x===null||typeof x!=='object'?JSON.stringify(x):Array.isArray(x)?
  '['+x.map(canonical).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join()===keys.split(',').sort().join();
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const id=x=>typeof x==='string'&&/^[a-z0-9-]{16,64}$/.test(x);
function validateService(s){
  if(!exact(s,'protocol,installationId,host,deviceName,expectedBuild,expectedModel')||s.protocol!==2||!id(s.installationId)||
    typeof s.host!=='string'||s.host.length>253||!s.host.includes('.')||
    !s.host.split('.').every(x=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(x))||
    typeof s.deviceName!=='string'||!s.deviceName.length||s.deviceName.length>64||
    typeof s.expectedBuild!=='string'||!/^\d{1,10}$/.test(s.expectedBuild)||
    typeof s.expectedModel!=='string'||!s.expectedModel.length||s.expectedModel.length>64)throw Error('invalid_service');
  return s;
}
function validateTask(t){
  const active=t?.kind==='execute';
  const keys='runId,kind,delayMs,startGraceMs,waitTargetMs,durationMs'+(active?',maxAttempts,referenceMs,tailMs':'');
  if(!exact(t,keys)||!id(t.runId)||
    !['observe','probe','execute'].includes(t.kind)||!['delayMs','startGraceMs','waitTargetMs','durationMs'].every(k=>integer(t[k]))||
    t.delayMs>86400000||t.startGraceMs<PERIOD||t.startGraceMs>1800000||
    (t.kind!=='probe'&&(t.durationMs<5000||t.durationMs>900000||t.waitTargetMs<1000||t.waitTargetMs>300000||
      t.waitTargetMs+t.durationMs>1200000))||
    (t.kind==='probe'&&(t.waitTargetMs!==0||t.durationMs!==PERIOD)))throw Error('invalid_task');
  if(active&&(!['maxAttempts','referenceMs','tailMs'].every(k=>integer(t[k]))||
    t.maxAttempts<1||t.maxAttempts>30||t.referenceMs<60000||t.tailMs<60000||
    t.referenceMs+t.tailMs>=t.durationMs))throw Error('invalid_action_limits');
  return t;
}
function bindingFor(s,t,now){
  const end=now+t.waitTargetMs+t.durationMs;
  return {enabled:true,runId:t.runId,mode:t.kind==='execute'?'execute':'observe',host:s.host,deviceName:s.deviceName,
    expectedBuild:s.expectedBuild,expectedModel:s.expectedModel,notBeforeMs:now,
    latestStartMs:Math.min(now+PERIOD,end-1),expiresMs:end,durationMs:t.durationMs,
    waitTargetMs:t.waitTargetMs,referenceMs:t.referenceMs??0,tailMs:t.tailMs??0,maxAttempts:t.maxAttempts??0,diagnostic:null};
}
function validateLedger(state,s){
  if(!Array.isArray(state.history)||state.history.length>16)throw Error('invalid_job_ledger');
  const records=[state.current,...state.history].filter(x=>x!==null),ids=new Set();
  for(const j of records){
    validateTask(j.task);
    if(ids.has(j.task.runId)||!['pending','running','stopping','cancelled','expired','finished'].includes(j.phase)||
      ![j.receivedMs,j.notBeforeMs,j.startByMs].every(integer)||j.notBeforeMs!==j.receivedMs+j.task.delayMs||
      j.startByMs!==j.notBeforeMs+j.task.startGraceMs)throw Error('invalid_job_ledger');
    ids.add(j.task.runId);
    if(j.binding!==null&&(!integer(j.startedMs)||j.task.kind==='probe'||
      canonical(j.binding)!==canonical(bindingFor(s,j.task,j.startedMs))))throw Error('invalid_saved_binding');
    if(['pending','expired'].includes(j.phase)&&(j.binding!==null||j.probeAtMs!==null))throw Error('invalid_pending_job');
    if(['running','stopping','finished'].includes(j.phase)&&
      (!integer(j.startedMs)||j.startedMs<j.notBeforeMs||j.startedMs>j.startByMs||
       (j.task.kind!=='probe'&&j.binding===null)||
       (j.task.kind==='probe'&&j.probeAtMs!==Math.floor(j.startedMs/PERIOD)*PERIOD+5000)))throw Error('invalid_started_job');
  }
}
function context(s,o){
  validateService(s);
  if(!/^[a-f0-9]{64}$/.test(o.codeId)||!ownerIdentity(o.sessionId)||!integer(o.now()))throw Error('invalid_job_context');
  const prefix='vidhub-jobs-v2-'+s.installationId;
  // Separate one-shot generations serialize control/admission across JSCs. No
  // expiring lock, blanket reset or automatic reuse of an interrupted claim.
  const map=k=>prefix+k.slice(owner.PREFIX.length);
  const store={read:k=>o.read(map(k)),write:(k,v)=>o.write(v,map(k))};
  const key=(run,suffix)=>prefix+'-'+run+'-'+suffix;
  const put=(k,v)=>{if(o.write(v,k)!==true||o.read(k)!==v)throw Error('job_write_unconfirmed');};
  function head(){
    const h=owner.head(store);
    if(h.state&&(h.state.codeId!==o.codeId||h.state.service!==canonical(s)||!integer(h.state.clockMs)||
      o.now()<h.state.clockMs))throw Error('job_service_or_clock_changed');
    if(h.state)validateLedger(h.state,s);
    return h;
  }
  function transaction(fn){
    const h=head(),state=h.state?copy(h.state):{current:null,history:[]};
    const next=fn(state); // All validation before consuming a one-shot claim.
    const claimed=owner.begin(store,h,s.installationId,o.sessionId,o.codeId,header=>({
      ...header,closed:true,terminal:true,service:canonical(s),clockMs:o.now(),current:next.current,history:next.history}));
    if(!claimed.accepted)throw Error('job_control_busy');
    return claimed.state;
  }
  return {head,transaction,key,put};
}
function ownerIdentity(x){return typeof x==='string'&&/^[A-Za-z0-9-]{1,80}$/.test(x);}
function stopKey(run){return owner.PREFIX+'-'+run+'-stop';}
function runtimeState(o,j){
  if(j.resultKey){
    const s=owner.parse(o.read(j.resultKey));
    if(s.runId!==j.task.runId||s.codeId!==o.codeId||!s.closed||!s.terminal||
      canonical(JSON.parse(s.binding))!==canonical(j.binding))throw Error('job_saved_result_mismatch');
    return s;
  }
  const h=owner.head({read:o.read});
  if(!h.state||h.state.runId!==j.task.runId)return null;
  if(h.state.codeId!==o.codeId||canonical(JSON.parse(h.state.binding))!==canonical(j.binding))throw Error('job_runtime_mismatch');
  if(o.read(owner.HEAD)!==h.raw)throw Error('job_runtime_head_changed');
  return h.state;
}
function status(s,o,runId=null){
  const c=context(s,o),h=c.head(),j=h.state?.current;
  const picked=runId&&j?.task.runId!==runId?h.state?.history.find(x=>x.task.runId===runId):j;
  if(!picked)return {status:runId?'unknown_job':'idle',job:null};
  const result=copy(picked);
  if(result.phase==='pending'&&o.now()>result.startByMs)result.phase='expired';
  let runtime=null;
  if(result.task.kind!=='probe'&&result.binding){
    runtime=runtimeState(o,result);
    if(runtime?.terminal&&runtime.closed){result.phase='finished';result.reason=runtime.reason;
      result.resultKey=owner.key(runtime.generation,'state');}
  }
  if(result.task.kind==='probe'&&result.probeAtMs!==null&&o.now()>result.probeAtMs+112000&&
    ['running','stopping'].includes(result.phase)){
    const a=o.read(c.key(result.task.runId,'done-a')),b=o.read(c.key(result.task.runId,'done-b'));
    result.phase='finished';result.reason=a==='probe_complete'&&b==='probe_complete'?'probe_records_ready':'probe_incomplete';
  }
  return {status:result.phase,job:result,runtime,nowMs:o.now()};
}
const terminal=j=>['cancelled','expired','finished'].includes(j.phase);
function archive(state,j){state.history.push(j);if(state.history.length>16)state.history.shift();}
function submit(s,o,t,replaces=null){
  validateTask(t);
  if(t.kind==='execute'&&o.capabilities?.actionsQualified!==true)throw Error('active_build_not_qualified');
  if(replaces!==null&&!id(replaces))throw Error('invalid_replacement');
  const c=context(s,o),prior=c.head().state,existing=[prior?.current,...(prior?.history||[])].find(j=>j?.task.runId===t.runId);
  const spec=canonical(t),saved=o.read(c.key(t.runId,'spec'));
  if(existing){
    if(canonical(existing.task)!==spec)throw Error('run_id_payload_changed');
    return {...status(s,o,t.runId),duplicate:true};
  }
  if(saved!==null)throw Error('run_id_retired_or_submission_unconfirmed');
  if(o.read(owner.PREFIX+'-'+t.runId+'-root')!==null)throw Error('run_id_already_used_by_runtime');
  // A committed head is the only admission source. A failed spec write poisons
  // this ID; never retry it as a fresh task and silently move its time window.
  const now=o.now();
  const next=c.transaction(state=>{
    let old=state.current;
    if(old){
      old=status(s,o,old.task.runId).job;
      if(replaces!==null){
        if(old.task.runId!==replaces||!['pending','expired'].includes(old.phase)||old.binding!==null)
          throw Error('only_pending_job_can_be_replaced');
        old.phase='cancelled';old.reason='rescheduled';
      }else if(!terminal(old))throw Error('previous_job_not_finished');
      archive(state,old);
    }else if(replaces!==null)throw Error('replacement_job_missing');
    state.current={task:copy(t),receivedMs:now,notBeforeMs:now+t.delayMs,startByMs:now+t.delayMs+t.startGraceMs,
      phase:'pending',binding:null,probeAtMs:null,reason:null};return state;
  });
  c.put(c.key(t.runId,'spec'),spec);
  return {status:'pending',job:next.current,duplicate:false,received:true,started:false};
}
function cancel(s,o,runId){
  if(!id(runId))throw Error('invalid_run_id');
  const c=context(s,o),view=status(s,o,runId);
  if(!view.job)throw Error('unknown_job');
  if(terminal(view.job))return {...view,alreadyClosed:true,closureVerified:true};
  // Stop is monotonic. Even if the following ledger commit fails, no reset is
  // allowed; a worker sees the flag on its next check.
  c.put(stopKey(runId),'set');c.put(c.key(runId,'cancel'),'set');
  c.transaction(state=>{
    if(state.current?.task.runId!==runId)throw Error('job_changed');
    const j=state.current;
    j.phase=j.phase==='pending'?'cancelled':'stopping';j.reason='operator_stop';return state;
  });
  const result=status(s,o,runId);
  return {...result,closureVerified:result.status==='cancelled'||result.status==='finished'};
}
function admit(s,o,role){
  if(!['worker','peer'].includes(role))throw Error('invalid_role');
  const c=context(s,o),current=c.head().state?.current;
  if(!current||terminal(current))return {reason:'idle'};
  const view=status(s,o),j=view.job,now=o.now();
  if(!j||terminal({...j,phase:view.status}))return {reason:'idle'};
  if(j.task.kind!=='probe'&&role==='peer')return {reason:'idle'};
  if(j.task.kind==='execute'&&o.capabilities?.actionsQualified!==true)return {reason:'active_build_not_qualified'};
  if(j.phase==='stopping')return {job:j,reason:'stopping'};
  if(now<j.notBeforeMs)return {reason:'waiting'};
  if(j.phase!=='pending')return {job:j};
  if(j.task.kind==='probe'&&now%PERIOD>1500)return {reason:'probe_waiting_boundary'};
  const next=c.transaction(state=>{
    if(state.current?.task.runId!==j.task.runId||state.current.phase!=='pending')throw Error('job_changed');
    if(o.read(c.key(j.task.runId,'cancel'))!==null)throw Error('job_cancelled');
    const x=state.current;x.phase='running';x.startedMs=now;
    if(x.task.kind!=='probe'){
      x.binding=bindingFor(s,x.task,now);
    }else x.probeAtMs=Math.floor(now/PERIOD)*PERIOD+5000;
    return state;
  });
  return {job:next.current};
}
function complete(s,o,runId,reason){
  const c=context(s,o);
  return c.transaction(state=>{
    if(state.current?.task.runId!==runId)throw Error('job_changed');
    if(state.current.task.kind!=='probe'){
      const h=owner.head({read:o.read});
      if(h.state?.runId===runId){
        if(!h.state.closed||!h.state.terminal)throw Error('worker_not_closed');
        state.current.resultKey=owner.key(h.state.generation,'state');
      }else if(reason!=='operator_stop')throw Error('worker_result_missing');
    }
    state.current.phase='finished';state.current.reason=reason;state.current.endedMs=o.now();return state;
  });
}
function control(q,o){
  if(!exact(q,'requestId,operation,service,codeId,task,runId,replaces')||!/^[a-f0-9]{32}$/.test(q.requestId)||
    !['submit','status','cancel','export'].includes(q.operation)||q.codeId!==o.codeId)throw Error('invalid_job_request');
  const s=validateService(q.service);let result;
  if(o.environment.system!=='tvOS'||String(o.environment['surge-build'])!==s.expectedBuild||
    o.environment['device-model']!==s.expectedModel||o.scriptType!=='generic')throw Error('wrong_tv_environment');
  if(q.operation==='submit'){
    if(q.runId!==null)throw Error('invalid_job_request');result=submit(s,o,q.task,q.replaces);
  }else{
    if(q.task!==null||q.replaces!==null||(q.runId!==null&&!id(q.runId)))throw Error('invalid_job_request');
    result=q.operation==='cancel'?cancel(s,o,q.runId):status(s,o,q.runId);
    if(q.operation==='export'&&result.job?.task.kind==='probe'){
      result.reports=[];
      for(let i=0;i<12;i++)for(const role of ['a','b']){
        const raw=o.read('vidhub-own-probe-'+result.job.task.runId+'-r'+i+'-'+role);
        if(raw!==null){const r=owner.parse(raw,8192);
          if(r.runId!==result.job.task.runId||r.round!==i||r.role!==role)throw Error('probe_record_mismatch');
          result.reports.push(r);}
      }
    }
    if(q.operation==='status'&&result.runtime){const r=result.runtime;
      result.runtime={runId:r.runId,closed:r.closed,terminal:r.terminal,reason:r.reason,samples:r.samples,
        sessions:r.sessions,originMs:r.originMs,invocations:r.invocations,attemptsReserved:r.attemptsReserved};}
  }
  return {requestId:q.requestId,operation:q.operation,...result};
}
module.exports={PERIOD,canonical,validateService,validateTask,context,status,submit,cancel,admit,complete,control};

};
__factories["src/autonomous/job-probe"]=function(module,exports,require){
// Store probe v2 candidate: twelve rounds inside two bounded configured sessions.
'use strict';
function start(job,role,o){
  if(!['a','b'].includes(role))throw Error('invalid_probe_role');
  const run=job.task.runId,anchor=job.probeAtMs,end=anchor+112000;
  let ended=false,round=0,last=o.now();
  function done(reason){if(!ended){ended=true;o.done(reason);}}
  function guard(fn){if(ended)return;try{
    const now=o.now();if(now<last||now>end){done('probe_clock_or_window');return;}last=now;
    if(o.cancelled()){done('operator_stop');return;}fn();
  }catch(_){done('probe_store_error');}}
  function schedule(fn,ms){o.schedule(()=>guard(fn),Math.max(1,ms));}
  function begin(){
    if(round===12){done('probe_complete');return;}
    const at=anchor+round*10000;
    if(o.now()<at){schedule(begin,at-o.now());return;}
    if(o.now()-at>1500){done('probe_missed_round');return;}
    const prefix='vidhub-own-probe-'+run+'-r'+round,key=prefix+'-'+role;
    if(o.read(key)!==null){done('probe_duplicate_role');return;}
    const startMs=o.now(),ops=[],id=role+'-'+o.sessionId;let step=0,winner=false;
    function finish(){
      const report={version:1,runId:run,round,role,sessionId:o.sessionId,startMs,endMs:o.now(),winner,ops};
      if(o.write(JSON.stringify(report),key)!==true)throw Error('report_write_failed');
      round++;schedule(begin,1);
    }
    function next(){
      if(o.now()-startMs>2000){done('probe_round_timeout');return;}
      let value;
      if(step===0&&o.write(id,prefix+'-race')!==true)throw Error('store_write_failed');
      if(step===1){value=o.read(prefix+'-door');if(value!==null){ops.push([o.now(),step,value]);finish();return;}}
      if(step===2&&o.write('closed',prefix+'-door')!==true)throw Error('store_write_failed');
      if(step===3){value=o.read(prefix+'-race');winner=value===id;}
      ops.push([o.now(),step,value===undefined?null:value]);step++;
      if(step===4){finish();return;}
      schedule(next,10+((round+(role==='a'?step:3-step))%3)*10);
    }
    next();
  }
  guard(begin);
}
module.exports={start};

};
__factories["src/autonomous/job-service"]=function(module,exports,require){
// Job service v2 extension: configured timers own sampling and bounded actions; control is store-only.
'use strict';
const jobs=require('./jobs'),runtime=require('./runtime'),probe=require('./job-probe'),owner=require('./ownership');
function dispatch(service,role,o){
  const s=jobs.validateService(service),began=o.now();let ended=false;
  const done=result=>{if(!ended){ended=true;o.done(result);}};
  const c=jobs.context(s,o);
  function attempt(){
    if(ended)return;
    let admitted;
    try{admitted=jobs.admit(s,o,role);}catch(e){
      if(['job_control_busy','parent_changed_during_claim','job_changed'].includes(e.message)&&o.now()-began<1200){
        o.schedule(attempt,50);return;}
      done({reason:e.message});return;
    }
    const j=admitted.job;if(!j){done({reason:admitted.reason,quiet:true});return;}
    if(j.task.kind!=='probe'){
      if(role!=='worker'){done({reason:'idle',quiet:true});return;}
      o.setBinding(j.binding);
      try{runtime.start({binding:j.binding,codeId:o.codeId,sessionId:o.sessionId,capabilities:o.capabilities??{actionsQualified:false},
        now:o.now,schedule:o.schedule,readStore:o.read,writeStore:o.write,api:o.api,done:result=>{
          try{
            const h=owner.head({read:o.read});
            if(h.state?.runId===j.task.runId&&h.state.closed&&h.state.terminal){
              jobs.complete(s,o,j.task.runId,h.state.reason);
            }else if(result.reason==='stop_flag')jobs.complete(s,o,j.task.runId,'operator_stop');
          }catch(_){/* Keep the runtime evidence; never infer closure from a failed ledger write. */}
          done(result);
        }});
      }catch(e){done({reason:e.message});}
      return;
    }
    const actor=role==='worker'?'a':'b',actorKey=c.key(j.task.runId,'actor-'+actor);
    // One-shot admission per role protects against duplicate cron invocations.
    if(o.read(actorKey)!==null){done({reason:'probe_role_already_started',quiet:true});return;}
    const roleStore={read:k=>o.read(c.key(j.task.runId+'-'+actor,k.slice(owner.PREFIX.length+1))),
      write:(k,v)=>o.write(v,c.key(j.task.runId+'-'+actor,k.slice(owner.PREFIX.length+1)))};
    try{
      if(!owner.claim(roleStore,0,o.sessionId)){done({reason:'probe_role_busy'});return;}
      c.put(actorKey,o.sessionId);
      probe.start(j,actor,{...o,cancelled:()=>o.read(c.key(j.task.runId,'cancel'))!==null,done:reason=>{
        try{
          c.put(c.key(j.task.runId,'done-'+actor),reason);
          const a=o.read(c.key(j.task.runId,'done-a')),b=o.read(c.key(j.task.runId,'done-b'));
          if(a!==null&&b!==null)jobs.complete(s,o,j.task.runId,a==='probe_complete'&&b==='probe_complete'?
            'probe_records_ready':'probe_incomplete');
        }catch(_){/* Missing completion remains visible and blocks automatic replacement. */}
        done({reason});
      }});
    }catch(e){done({reason:e.message});}
  }
  attempt();
}
module.exports={dispatch};

};
(function(){
  'use strict';
  let finished=false;
  function done(result){if(!finished){finished=true;console.log('VIDHUB_AUTONOMOUS '+JSON.stringify(result));$done();}}
  try{
    if(typeof $argument!=='string'||$argument.length>8192)throw Error('invalid_argument');
    const envelope=JSON.parse(decodeURIComponent($argument));
    if(envelope&&Object.keys(envelope).sort().join()==='operation,service'&&envelope.operation==='service'){
      const s=__require('src/autonomous/jobs').validateService(envelope.service);
      if($environment.system!=='tvOS'||String($environment['surge-build'])!==s.expectedBuild||
        $environment['device-model']!==s.expectedModel)throw Error('wrong_tv_environment');
      const role=$script.name==='vidhub-job-worker'?'worker':$script.name==='vidhub-job-peer'?'peer':null;
      if(!role||$script.type!=='cron'||typeof $trigger!=='undefined'||typeof $cronexp!=='string'||
        $cronexp!=='0 */2 * * * *')throw Error('configured_timer_required');
      // Core module defaults need the fixed target before the runtime is loaded.
      __binding=s;
      __require('src/autonomous/job-service').dispatch(s,role,{codeId:__codeId,sessionId:$script.sessionID,capabilities:__capabilities,
        now:()=>Date.now(),schedule:(fn,ms)=>setTimeout(fn,ms),read:k=>$persistentStore.read(k),
        write:(v,k)=>$persistentStore.write(v,k),setBinding:b=>{__binding=b;},
        api:(method,path,body,cb)=>{
          const read=method==='GET'&&path==='/v1/requests/active'&&body===null;
          const kill=__capabilities.actionsQualified===true&&__binding.mode==='execute'&&method==='POST'&&
            path==='/v1/requests/kill'&&body&&Object.keys(body).join()==='id'&&Number.isSafeInteger(body.id)&&body.id>=0;
          if(!read&&!kill)throw Error('api_not_allowed');
          $httpAPI(method,path,body,cb);
        },done:result=>{if(result.quiet){if(!finished){finished=true;$done();}}else done(result);}});
      return;
    }
    if(!envelope||Object.keys(envelope).sort().join()!=='binding,operation')throw Error('invalid_envelope');
    const b=envelope.binding;
    if(!b||b.enabled!==true){done({reason:'disabled'});return;}
    __binding=b;
    if(typeof $environment!=='object'||$environment.system!=='tvOS'||
      String($environment['surge-build'])!==b.expectedBuild||$environment['device-model']!==b.expectedModel||
      typeof $script!=='object'||typeof $script.sessionID!=='string')throw Error('wrong_tv_environment');
    const op=envelope.operation;
    if(op==='worker'){
      if($script.type!=='cron'||$script.name!=='vidhub-autonomous-worker'||
        typeof $trigger!=='undefined'||typeof $cronexp!=='string'||$cronexp!=='0 */2 * * * *')
        throw Error('configured_timer_required');
      __require('src/autonomous/runtime').start({binding:b,codeId:__codeId,sessionId:$script.sessionID,
        capabilities:__capabilities,now:()=>Date.now(),schedule:(fn,ms)=>setTimeout(fn,ms),
        readStore:k=>$persistentStore.read(k),writeStore:(v,k)=>$persistentStore.write(v,k),
        api:(method,path,body,cb)=>{
          const read=method==='GET'&&path==='/v1/requests/active'&&body===null;
          const kill=__capabilities.actionsQualified&&b.mode!=='observe'&&method==='POST'&&
            path==='/v1/requests/kill'&&body&&Object.keys(body).join()==='id'&&Number.isSafeInteger(body.id)&&body.id>=0;
          if(!read&&!kill)throw Error('api_not_allowed');$httpAPI(method,path,body,cb);
        },done});
    }else{
      __require('src/autonomous/runtime').validate(b);
      const owner=__require('src/autonomous/ownership');
      if($script.type!=='generic'||$script.name!=='vidhub-autonomous-'+op||!['read','stop','observe'].includes(op))
        throw Error('configured_control_required');
      const head=owner.head({read:k=>$persistentStore.read(k)});
      if(!head.state||head.state.runId!==b.runId||
        (head.state.codeId!==__codeId&&op==='read')){done({reason:'no_matching_run'});return;}
      if(op==='read'){done({state:head.state,nowMs:Date.now()});return;}
      const key=owner.PREFIX+'-'+b.runId+'-'+op;
      if($persistentStore.read(key)===null&&$persistentStore.write('set',key)!==true)throw Error('control_write_failed');
      done({signalSet:true,operation:op,runId:b.runId});
    }
  }catch(e){done({reason:e&&/^[a-z_]{1,80}$/.test(e.message)?e.message:'invalid_configuration_or_runtime'});}
}());

}());
