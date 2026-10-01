// Version 03fe900b48ad3d0d8a61c3432483ce87ef985ed7cc92984dd92a5653d50babf1; phase: adaptive WAIT sampling candidate; continuous-only 5 Hz quiet / 10 Hz active; protected resume; action-trial build; runtime acceptance pending.
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
const __codeId="03fe900b48ad3d0d8a61c3432483ce87ef985ed7cc92984dd92a5653d50babf1";
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
__factories["src/policy/recovery-review-policy"]=function(module,exports,require){
'use strict';
// Candidate policy only, enabled by the explicit long-v1 task profile.
// A stagnant successor is a separate decision; ordinary WAIT stays protected.
const DEFAULTS=Object.freeze({observation_s:5,stall_s:3,tracking_s:30,max_rescues:1,
  progress_s:1,progress_bytes:65536,near_zero_Bps:40960,dip_s:1.5,fast_memory_s:10});
const fp=r=>`${r.id}/${r.started}/${r.engine}`;
const fresh=()=>({actionAt:null,old:null,known:[],successor:null,previous:null,quietAt:null,
  progressSeconds:0,progressBytes:0,started:false,resumed:false,disarmed:null,rescues:0,fast:null,
  hadTarget:false,emptyAt:null,emptyLast:null,entryAt:null});
class RecoveryReview {
  constructor(){this.s=fresh();}
  afterAction(action,t){
    const rescue=action.decision?.reason==='stalled_own_successor';
    const used=this.s.resumed?0:this.s.rescues;
    this.s={...fresh(),actionAt:t,old:fp(action.connection),known:action.pre_action_targets.map(fp),
      rescues:rescue?used+1:used,hadTarget:true};
    if(action.pre_action_targets.length!==1)this.s.disarmed='successor_lost_or_ambiguous';
  }
  ingest(f){
    const s=this.s,p=f.point,t=f.time_s;
    // Absence polling is 1 Hz, outside the speed detector's 0.5 s limit.
    // Observe absence explicitly so a later viewing session still gets its
    // existing four seconds from first appearance. Continuous ID churn does not.
    if(f.read_ms<=250&&f.targets.length===0){
      if(s.emptyLast===null||t-s.emptyLast>1.5)s.emptyAt=t;
      s.emptyLast=t;
    }else if(f.targets.length){
      const ownPending=s.actionAt!==null&&!s.started&&!s.disarmed&&t-s.actionAt<=DEFAULTS.tracking_s;
      if(!ownPending&&(!s.hadTarget||(s.emptyAt!==null&&s.emptyLast-s.emptyAt>=.6)))s.entryAt=t;
      s.hadTarget=true;s.emptyAt=null;s.emptyLast=null;
    }else {s.emptyAt=null;s.emptyLast=null;}
    if(s.actionAt!==null&&p.reliable_read&&p.state==='DOWNLOAD'&&!p.protected&&f.unique_main&&p.main_delta_bytes>0)
      s.started=true;
    if(p.reliable_read&&p.state==='DOWNLOAD'&&f.unique_main&&p.phase_rate_Bps>=2000000){
      const r=f.targets.find(x=>x.id===p.main_id);if(r)s.fast={id:fp(r),at:t};
    }else if(p.state==='WAIT')s.fast=null;
    if(s.actionAt===null||s.resumed||s.disarmed)return;
    if(t-s.actionAt>DEFAULTS.tracking_s){s.disarmed='recovery_tracking_expired';return;}
    // Multiple possible successors or disappearance cannot establish lineage.
    if(f.targets.length!==1||s.known.includes(fp(f.targets[0]))){
      if(s.successor!==null)s.disarmed='successor_lost_or_ambiguous';
      s.previous=null;s.quietAt=null;return;
    }
    const r=f.targets[0],id=fp(r);
    if(s.successor===null&&r.inBytes>=DEFAULTS.progress_bytes)s.started=true;
    if(s.successor!==null&&s.successor!==id){s.disarmed='successor_changed';return;}
    s.successor=id;
    const prior=s.previous,dt=prior?t-prior.t:null,delta=prior?r.inBytes-prior.bytes:null;
    const reliable=p.reliable_read===true&&f.read_ms<=250&&prior&&prior.readMs<=250&&dt>0&&dt<=.5&&delta>=0;
    s.previous={t,bytes:r.inBytes,readMs:f.read_ms};
    if(!reliable){s.quietAt=null;return;}
    if(delta/dt>=DEFAULTS.near_zero_Bps){
      s.progressSeconds+=dt;s.progressBytes+=delta;s.quietAt=null;
      if(s.progressSeconds+1e-9>=DEFAULTS.progress_s&&s.progressBytes>=DEFAULTS.progress_bytes){
        s.resumed=true;s.rescues=0;
      }
    }else if(s.quietAt===null)s.quietAt=prior.t;
  }
  consider(f){
    const s=this.s,t=f.time_s;
    if(s.actionAt===null||s.started||s.resumed||s.disarmed)return null;
    if(t-s.actionAt<DEFAULTS.observation_s||!f.rearm.window_complete)return null;
    if(s.rescues>=DEFAULTS.max_rescues)return {row:null,reason:'recovery_rescue_budget_exhausted'};
    if(!f.point.reliable_read||f.read_ms>250||s.quietAt===null||t-s.quietAt<DEFAULTS.stall_s||
      f.targets.length!==1||fp(f.targets[0])!==s.successor)return null;
    // A normal productive candidate uses the ordinary measurement path.
    if(f.point.state==='DOWNLOAD'&&!f.point.protected)return null;
    return {row:f.targets[0],reason:'stalled_own_successor'};
  }
  filter(f,d){
    const fast=this.s.fast,p=f.point;
    if(d.row&&this.s.entryAt!==null&&f.time_s-this.s.entryAt<4)
      return {row:null,reason:'natural_download_startup'};
    if(d.row&&fast&&fast.id===fp(d.row)&&f.time_s-fast.at<=DEFAULTS.fast_memory_s&&
      p.low_since_s!==null&&p.elapsed_s-p.low_since_s<DEFAULTS.dip_s)
      return {row:null,reason:'recent_fast_dip_confirmation'};
    return d;
  }
}
module.exports={RecoveryReview,DEFAULTS};

};
__factories["src/policy/decision-evidence"]=function(module,exports,require){
'use strict';
// Read-only snapshot of already evaluated gates. Never calls consider/ingest,
// changes policy state, or interprets a rising curve as a new veto.
const {DEFAULTS}=require('./recovery-review-policy');
const fp=r=>`${r.id}/${r.started}/${r.engine}`;
const remaining=(end,t)=>end===null?0:Math.max(0,end-t);
function explain(pipeline,f,d,first=null){
 const p=f.point,g=pipeline.gate,s=pipeline.review?.s??null;
 const main=d.row??f.targets.find(r=>r.id===p.main_id)??null;
 const sameFast=!!(main&&s?.fast&&s.fast.id===fp(main));
 const lowAge=p.low_since_s===null?null:p.elapsed_s-p.low_since_s;
 const recentFast=sameFast&&f.time_s-s.fast.at<=DEFAULTS.fast_memory_s;
 const replacement=pipeline.replacement;
 return {version:1,stage:first?'action_revalidation':'gate_evaluation',frameTimeS:f.time_s,receivedMs:f.received_ms,
  finalReason:d.reason,path:d.reason==='stalled_own_successor'?'own_stalled_successor':'productive_download',
  ...(f.sampling?{sampling:{...f.sampling}}:{}),
  read:{durationMs:f.read_ms,reliable:p.reliable_read,uniqueMain:f.unique_main},
  core:{reason:p.decision_reason,elapsedS:p.elapsed_s,lowAgeS:lowAge,recoveryUsed:p.recovery_used,
   holdUntilElapsedS:p.hold_until_s,holdRemainingS:remaining(p.hold_until_s,p.elapsed_s)},
  executor:{episode:g.episode,recoveryUsed:g.recoveryUsed,holdUntilTimeS:g.holdUntil,
   holdRemainingS:remaining(g.holdUntil,f.time_s)},
  recovery:s?{lastFastTimeS:s.fast?.at??null,lastFastSameConnection:sameFast,
   recentFastWithinMemory:recentFast,dipRequiredS:DEFAULTS.dip_s,
   dipRemainingS:recentFast&&lowAge!==null?Math.max(0,DEFAULTS.dip_s-lowAge):0,
   entryAtS:s.entryAt,entryRemainingS:remaining(s.entryAt===null?null:s.entryAt+4,f.time_s),
   ownActionAtS:s.actionAt,quietAtS:s.quietAt,started:s.started,resumed:s.resumed,
   disarmed:s.disarmed,rescuesUsed:s.rescues,progressSeconds:s.progressSeconds,progressBytes:s.progressBytes}:null,
  replacement:replacement?{absentReads:replacement.absent,allowedForSelected:main?replacement.allows(main):null}:null,
  revalidation:first?{firstReceivedMs:first.receivedMs,firstReason:first.reason,
   intervalMs:f.received_ms-first.receivedMs,sameIdentity:!!main&&fp(main)===fp(first.row),
   addedBytes:main?main.inBytes-first.row.inBytes:null}:null};
}
module.exports={explain};

};
__factories["src/policy/wait-sampling"]=function(module,exports,require){
'use strict';
// Continuous runtime only. Dwell is ephemeral; a lost WAIT and its one-shot
// measurement bound are durable. This is not a player buffer-watermark signal.
const FAST=100,WAIT=200,ABSENT=1000,DWELL=1000;
const fp=r=>`${r.id}/${r.started}/${r.engine}`;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const fresh=()=>({version:1,intent:null,identity:null,growthUpperMs:null,newSeenMs:null,newSeenKey:null,
  guardStartMs:null,guardUntilMs:null});
class WaitSampling {
  constructor(saved=null){this.s=saved?WaitSampling.validate(saved):fresh();this.resetCadence(false);}
  static validate(s){
    if(!s||Object.keys(s).sort().join()!==Object.keys(fresh()).sort().join()||s.version!==1||
      ![null,'waiting','uncertain'].includes(s.intent)||
      !(s.identity===null||typeof s.identity==='string'&&s.identity.length<150)||
      !(s.newSeenKey===null||typeof s.newSeenKey==='string'&&s.newSeenKey.length<150)||
      ((s.newSeenMs===null)!==(s.newSeenKey===null))||
      !['growthUpperMs','newSeenMs','guardStartMs','guardUntilMs'].every(k=>s[k]===null||finite(s[k])&&s[k]>=0)||
      ((s.guardStartMs===null)!==(s.guardUntilMs===null))||
      (s.guardStartMs!==null&&Math.abs(s.guardUntilMs-s.guardStartMs-4000)>1e-5)||
      (s.intent===null&&(s.identity!==null||s.growthUpperMs!==null||s.newSeenMs!==null||s.newSeenKey!==null))||
      (s.intent!==null&&s.identity===null))throw Error('invalid_wait_sampling');
    return {...s};
  }
  resetCadence(markLost=true){
    this.previous=null;this.stableSince=null;this.periodMs=FAST;this.coarseRead=false;this.unchanged=false;
    // A handoff must not forget a coarse interval that might contain growth.
    if(markLost&&this.s.intent!==null)this.s.intent='uncertain';
  }
  lost(){if(this.s.intent!==null)this.s.intent='uncertain';this.s.newSeenMs=null;this.s.newSeenKey=null;
    this.stableSince=null;this.periodMs=FAST;}
  afterAction(){this.s=fresh();this.resetCadence();}
  ingest(f){
    const s=this.s,t=f.time_s*1000,row=f.targets.length===1?f.targets[0]:null,old=this.previous;
    const same=!!(row&&old&&old.key===fp(row));
    const contiguous=f.read_ms<=250&&old&&old.readMs<=250&&t>old.time&&t-old.time<=500+1e-6&&
      (!same||row.inBytes>=old.bytes);
    const reliable=f.point.reliable_read===true&&contiguous&&same;
    this.unchanged=!!(reliable&&row.inBytes===old.bytes);
    this.coarseRead=this.periodMs===WAIT;
    if(s.intent!==null){
      if(!reliable){
        s.intent='uncertain';
        // New identities retain their first-observed natural startup origin.
        // Do not move it forward on each baseline/read or on continuous churn.
        if(!contiguous||!row||(s.newSeenKey!==null&&fp(row)!==s.newSeenKey)){s.newSeenMs=null;s.newSeenKey=null;}
        if(row&&fp(row)!==s.identity&&(!old||fp(row)!==old.key)&&s.newSeenMs===null&&f.read_ms<=250){
          s.newSeenMs=t;s.newSeenKey=fp(row);
        }
      }else if(row.inBytes>old.bytes&&s.growthUpperMs===null){s.growthUpperMs=f.received_ms;}
      const p=f.point,substantial=p.reliable_read===true&&f.read_ms<=250&&p.state==='DOWNLOAD'&&
        p.protected===false&&f.unique_main===true&&p.main_delta_bytes>0&&p.main_delta_bytes>=p.current_growth_floor_bytes;
      if(substantial){
        const start=s.newSeenMs??(s.intent==='uncertain'?f.received_ms:s.growthUpperMs??f.received_ms);
        s.guardStartMs=start;s.guardUntilMs=start+4000;
        s.intent=null;s.identity=null;s.growthUpperMs=null;s.newSeenMs=null;s.newSeenKey=null;
      }
    }
    this.previous=row?{key:fp(row),bytes:row.inBytes,time:t,readMs:f.read_ms}:null;
    return this.view(f);
  }
  view(f){return {periodMs:this.periodMs,coarseRead:!!this.coarseRead,intent:this.s.intent,
    guardStartMs:this.s.guardStartMs,guardUntilMs:this.s.guardUntilMs,
    remainingMs:this.s.guardUntilMs===null?0:Math.max(0,this.s.guardUntilMs-f.time_s*1000)};}
  filter(f,d){
    if(!d.row)return d;
    if(this.s.intent!==null)return {row:null,reason:'sampling_wait_resume_unresolved'};
    if(this.s.guardUntilMs!==null&&f.time_s*1000<this.s.guardUntilMs)
      return {row:null,reason:'sampling_resume_startup'};
    if(this.coarseRead)return {row:null,reason:'sampling_requires_fast_recheck'};
    return d;
  }
  next(f,pipeline,pending){
    const s=this.s,r=pipeline.review?.s,p=f.point;
    const ownPending=r&&r.actionAt!==null&&!r.resumed&&!r.disarmed;
    const entryPending=r&&r.entryAt!=null&&f.time_s-r.entryAt<4;
    const safe=this.unchanged&&f.targets.length===1&&p.state==='WAIT'&&p.protected===false&&
      f.startup.waiting&&!f.startup.awaiting_own_successor&&f.startup.remaining_s===0&&
      f.rearm.window_remaining_s===0&&!ownPending&&!entryPending&&!pending&&
      (s.guardUntilMs===null||f.time_s*1000>=s.guardUntilMs);
    if(safe){
      if(this.stableSince===null)this.stableSince=f.time_s*1000;
      if(f.time_s*1000-this.stableSince>=DWELL-1e-6){
        // Reliable quiet re-established: an isolated pulse cannot consume a
        // later download's origin. Only renewed confirmed WAIT rearms this.
        s.intent='waiting';s.identity=fp(f.targets[0]);s.growthUpperMs=null;s.newSeenMs=null;s.newSeenKey=null;
        this.periodMs=WAIT;return WAIT;
      }
    }else this.stableSince=null;
    this.periodMs=f.targets.length?FAST:ABSENT;return this.periodMs;
  }
}
module.exports={WaitSampling,FAST,WAIT,ABSENT,DWELL};

};
__factories["src/pipeline"]=function(module,exports,require){
'use strict';
// Pure TV decision pipeline. The executed historical modules remain unchanged.
const {Detector}=require('./core/detector');
const {create}=require('./core/adapter');
const {RetryRearm}=require('./policy/retry-rearm-policy');
const {DownloadStartup}=require('./policy/download-startup-policy');
const {RecoveryReview}=require('./policy/recovery-review-policy');
const {WaitSampling}=require('./policy/wait-sampling');
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
  enableWaitSampling(saved=null){
    if(!this.continuous)throw Error('wait_sampling_requires_continuous');
    this.sampling=new WaitSampling(saved);
  }
  constructor(profile=null){
    if(profile!==null&&!['long-v1','continuous-v1'].includes(profile))throw Error('invalid_pipeline_profile');
    this.continuous=profile==='continuous-v1';
    this.review=profile!==null?new RecoveryReview():null;
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
      this.seen.set(row.id,fp);
      if(this.continuous&&this.seen.size>1024){const present=new Set(mapped.map(r=>r.id));
        for(const id of this.seen.keys())if(!present.has(id)){this.seen.delete(id);break;}}
      if(this.seen.size>(this.review?1024:256))throw Error('identity_history_capacity');
      return row;
    });
    const time_s=(beginMs+endMs)/2000,read_ms=endMs-beginMs;
    if(this.lastTime!==null&&time_s<=this.lastTime)throw Error('non_increasing_clock');
    this.lastTime=time_s;
    const point=this.detector.ingest({time_s,read_ms,targets:mapped});
    if(point.needs_baseline)throw Error('invalid_core_sample');
    const frame={time_s,read_ms,received_ms:endMs,point,targets,unique_main:uniqueMain(this.detector,point)};
    frame.rearm=this.own.ingest(frame);frame.startup=this.startup.ingest(frame);
    if(this.replacement){
      this.replacement.observe(frame);
      if(this.review){const present=new Set(targets.map(fingerprint));
        this.replacement.growing=new Set([...this.replacement.growing].filter(k=>present.has(k)));}
    }
    if(this.review)this.review.ingest(frame);
    if(this.sampling)frame.sampling=this.sampling.ingest(frame);
    return frame;
  }
  consider(frame){
    const d=this.considerMeasurement(frame);
    return this.sampling?this.sampling.filter(frame,d):d;
  }
  considerMeasurement(frame){
    const rescue=this.review?.consider(frame);
    if(rescue?.row)return rescue;
    const decision=this.gate.consider(frame);
    if(!decision.row)return rescue||decision;
    if(!frame.rearm.retry_allowed)return {row:null,reason:frame.rearm.reason};
    if(!frame.startup.startup_permits_retry)return {row:null,reason:frame.startup.reason};
    if(this.replacement&&!this.replacement.allows(decision.row))return {row:null,reason:'replacement_not_confirmed'};
    return this.review?this.review.filter(frame,decision):decision;
  }
  revalidate(first,last,nowMs){
    const d=this.consider(last);if(!d.row)return d;
    const rescue=d.reason==='stalled_own_successor';
    const dt=(last.received_ms-first.receivedMs)/1000,delta=d.row.inBytes-first.row.inBytes;
    const stillNearZero=dt>0&&dt<=.5&&delta>=0&&delta/dt<=POLICY.near_zero_Bps;
    if((rescue&&first.reason!==d.reason)||fingerprint(first.row)!==fingerprint(d.row)||
      (rescue?!stillNearZero:d.row.inBytes<=first.row.inBytes))
      return {row:null,reason:'identity_changed_or_no_new_growth'};
    if(!finite(nowMs)||nowMs-last.received_ms<0||nowMs-last.received_ms>250)
      return {row:null,reason:'stale_before_dispatch'};
    return d;
  }
  afterAction(action,timeMs){
    if(this.sampling)this.sampling.afterAction();
    if(this.review)this.review.afterAction(action,timeMs/1000);
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
__factories["src/autonomous/schedule"]=function(module,exports,require){
'use strict';
// One reviewed schedule and task limits for runtime, generation and preflight.
// Longer periods require separate tvOS lifetime acceptance before this value changes.
module.exports=Object.freeze({periodMs:120000,cron:'0 */2 * * * *',timeoutSeconds:120,
  reserveMs:300,checkpointMs:30000,readTimeoutMs:1000,readRetryMs:[1000,2000,4000],
  takeoverGraceMs:0,healthStaleMs:45000,finiteMaxAttempts:30,longMaxAttempts:100});

};
__factories["src/autonomous/ownership"]=function(module,exports,require){
'use strict';
// One-shot splitter, NOT a reusable read/write lease. Each generation uses new
// registers, never reused. Continuous mode reclaims old generations only after
// HEAD has advanced; begin fences every claim write against its parent HEAD. The at-most-one-winner
// proof requires individually atomic, coherent read/write registers; Surge's
// cross-JSC store semantics must still be qualified on the actual TV.
const schedule=require('./schedule');
const PREFIX='vidhub-autonomous-v1';
const HEAD=PREFIX+'-head';
const key=(g,s)=>PREFIX+'-g'+g+'-'+s;
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const identity=x=>typeof x==='string'&&/^[A-Za-z0-9-]{1,80}$/.test(x);
function* splitter(g,id){
  if(!integer(g)||!identity(id))throw Error('invalid_owner_identity');
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
// Sealed excerpts are immutable and named by run/sequence. The generation state
// is the commit index: write/read back every page BEFORE committing that index.
// A crash can leave at most one unreferenced page per action (max 100), never a
// committed action whose page was intentionally skipped. Critical accounting,
// callbacks, timestamps and pipeline continuation stay in the generation state.
const DETAIL=['before','followup','decision','pre_action_targets','detailSamplesOmitted'];
const pageKey=(run,seq)=>PREFIX+'-'+run+'-action-'+seq;
function hydrate(store,s){
  if(!Array.isArray(s.actions))return s;
  for(const a of s.actions){
    if(!a.detailRef)continue;
    if(a.detailRef!==pageKey(s.runId,a.sequence))throw Error('invalid_evidence_reference');
    const page=parse(store.read(a.detailRef),16384);
    if(page.version!==1||page.runId!==s.runId||page.codeId!==s.codeId||page.sequence!==a.sequence||
      !page.detail||typeof page.detail!=='object'||Array.isArray(page.detail)||
      Object.keys(page.detail).some(k=>!DETAIL.includes(k))||!Array.isArray(page.detail.before)||
      !Array.isArray(page.detail.followup)||!page.detail.decision||!Array.isArray(page.detail.pre_action_targets))
      throw Error('evidence_page_mismatch');
    if(a.decision?.reason!==page.detail.decision.reason)throw Error('evidence_reason_mismatch');
    Object.assign(a,page.detail);delete a.detailRef;
    Object.defineProperty(a,'__sealedExcerpt',{value:true,configurable:true});
  }
  return s;
}
function writer(store){
  const cache=new Map();
  return function encode(s){
    if(!Array.isArray(s.actions))return JSON.stringify(s);
    const actions=s.actions.map(a=>{
      const sealed=s.closed&&s.terminal||a.startedMs!==null&&
        (s.updatedMs-a.startedMs>=30000||a.followupEndMs!==null&&s.updatedMs>=a.followupEndMs);
      if(!sealed)return a;
      const k=pageKey(s.runId,a.sequence);
      if(!cache.has(k)){
        const detail={};for(const field of DETAIL)if(a[field]!==undefined)detail[field]=a[field];
        const raw=JSON.stringify({version:1,runId:s.runId,codeId:s.codeId,sequence:a.sequence,detail});
        if(raw.length>16384)throw Error('evidence_page_capacity');
        const existing=store.read(k);
        if(existing!==null&&existing!==raw)throw Error('immutable_evidence_changed');
        if(existing===null&&(store.write(k,raw)!==true||store.read(k)!==raw))throw Error('evidence_write_failed');
        cache.set(k,true);
      }
      Object.defineProperty(a,'__sealedExcerpt',{value:true,configurable:true});
      const thin={...a,detailRef:k};for(const field of DETAIL)delete thin[field];
      thin.decision={reason:a.decision.reason};return thin;
    });
    return JSON.stringify({...s,storageVersion:2,actions});
  };
}
function health(s,t){
  if(!s)return null;
  let state=s.closed?(s.terminal?'ended':'waiting_next_batch'):'running';
  if(!s.closed&&Number.isSafeInteger(s.sessionDeadlineMs)&&t>=s.sessionDeadlineMs)state='interrupted';
  else if(!s.closed&&t-s.updatedMs>schedule.healthStaleMs)state='unresponsive';
  else if(!s.closed&&s.readFailures>0)state='retrying_read';
  else if(!s.closed&&s.lastTargetCount===0)state='waiting_target';
  else if(!s.closed&&s.lastTrafficState==='WAIT')state='waiting_download';
  const expiry=JSON.parse(s.binding).expiresMs;
  const afterDeadline=expiry!==null&&t>=expiry;
  if(afterDeadline&&!s.terminal)state='expired_awaiting_close';
  return {state,lastSuccessfulReadMs:s.lastSuccessfulReadMs??s.lastSampleMs??null,
    checkpointMs:s.updatedMs,sessionDeadlineMs:s.sessionDeadlineMs??null,
    expiresMs:JSON.parse(s.binding).expiresMs,readFailures:s.readFailures??0,
    readErrors:s.readErrors??0,recoveries:s.recoveries??0,lastFault:s.lastFault??null,
    diagnostics:s.diagnostics?{faultCounts:s.diagnostics.faultCounts,faultsDropped:s.diagnostics.faultsDropped,
      lastFault:s.diagnostics.faults.at(-1)??null,maxSavedGap:s.diagnostics.maxSavedGap}:null,
    actionsBlocked:s.terminal||s.continuous?.faultLocked===true||state==='interrupted'||state==='unresponsive'||state==='retrying_read'||afterDeadline,
    afterDeadline};
}
function head(store,details=true){
  const raw=store.read(HEAD);if(raw===null)return {raw:null,value:null,state:null};
  const h=parse(raw,2048);
  if(Object.keys(h).sort().join()!=='codeId,generation,runId,sessionId,version'||h.version!==1||
    !integer(h.generation)||!identity(h.sessionId)||!identity(h.runId)||
    typeof h.codeId!=='string'||!/^[a-f0-9]{64}$/.test(h.codeId))throw Error('invalid_head');
  const s=parse(store.read(key(h.generation,'state')));
  if(s.generation!==h.generation||s.sessionId!==h.sessionId||s.runId!==h.runId||s.codeId!==h.codeId||
    typeof s.closed!=='boolean'||typeof s.terminal!=='boolean')throw Error('head_state_mismatch');
  return {raw,value:h,state:details?hydrate(store,s):s};
}
function begin(store,parent,runId,sessionId,codeId,makeState,recoveryAt=null){
  const generation=parent.value?parent.value.generation+1:0;
  const fenced=recoveryAt!==null&&integer(recoveryAt)&&parent.state?.runId===runId&&
    parent.state.codeId===codeId&&integer(parent.state.sessionDeadlineMs)&&recoveryAt>=parent.state.sessionDeadlineMs+schedule.takeoverGraceMs;
  if(parent.state&&((!parent.state.closed&&!fenced)||(!parent.state.terminal&&parent.state.runId!==runId)))
    return {accepted:false,reason:'previous_worker_not_closed'};
  const fencedStore={read:store.read,write:(k,v)=>{
    if(store.read(HEAD)!==parent.raw)throw Error('parent_changed_during_claim');
    return store.write(k,v);
  }};
  if(!claim(fencedStore,generation,sessionId))return {accepted:false,reason:'splitter_not_won'};
  if(store.read(HEAD)!==parent.raw)throw Error('parent_changed_during_claim');
  const h={version:1,generation,runId,sessionId,codeId};
  const s=makeState(h);const raw=writer(store)(s),header=JSON.stringify(h);
  if(raw.length>524288||store.write(key(generation,'state'),raw)!==true||
    store.read(key(generation,'state'))!==raw)throw Error('initial_state_write_failed');
  if(store.write(HEAD,header)!==true||store.read(HEAD)!==header)throw Error('head_write_failed');
  return {accepted:true,header,state:s};
}
module.exports={PREFIX,HEAD,key,splitter,claim,parse,head,begin,hydrate,writer,health,pageKey};

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
  if(Object.keys(x).length>1024)throw Error('snapshot_capacity');
  for(const k of Object.keys(x)){
    if(['__proto__','constructor','prototype'].includes(k))throw Error('snapshot_key');
    inspectJSON(x[k],depth+1);
  }
}
function capture(p){
  const s=p.startup;
  return copy({version:1,...(p.continuous?{continuous:true}:{}),...(p.sampling?{sampling:p.sampling.s}:{}),...(p.review?{review:p.review.s}:{}),core:p.detector.checkpoint(),own:{actionAt:p.own.actionAt,lastClock:p.own.lastClock},
    startup:{clock:s.clock,previous:s.previous?{...s.previous,rows:[...s.previous.rows]}:null,
      history:s.history,tracks:[...s.tracks],quietSince:s.quietSince,waiting:s.waiting,waitOrigin:s.waitOrigin,
      start:s.start,end:s.end,source:s.source,episode:s.episode,awaitOwnSuccessor:s.awaitOwnSuccessor},
    gate:{episode:p.gate.episode,recoveryUsed:p.gate.recoveryUsed,holdUntil:p.gate.holdUntil},
    replacement:p.replacement?{old:p.replacement.old,known:[...p.replacement.known],growing:[...p.replacement.growing],
      absent:p.replacement.absent,previous:p.replacement.previous}:null,seen:[...p.seen],lastTime:p.lastTime});
}
function restore(x){
  if(JSON.stringify(x).length>196608)throw Error('snapshot_capacity');inspectJSON(x);
  exact(x,['version','core','own','startup','gate','replacement','seen','lastTime',...('review' in x?['review']:[]),...('continuous' in x?['continuous']:[]),...('sampling' in x?['sampling']:[])]);
  if(x.version!==1||!(x.lastTime===null||finite(x.lastTime)))throw Error('snapshot_version');
  if('continuous' in x&&x.continuous!==true)throw Error('snapshot_profile');
  const p=new Pipeline(x.continuous?'continuous-v1':'review' in x?'long-v1':null);if(!p.detector.restore(x.core))throw Error('snapshot_core');
  if('sampling' in x)p.enableWaitSampling(x.sampling);
  if(p.review){
    const r=x.review;exact(r,Object.keys(p.review.s));
    if(!times(r,['actionAt','quietAt','emptyAt','emptyLast','entryAt'])||typeof r.hadTarget!=='boolean'||!integer(r.rescues)||r.rescues>1||
      !finite(r.progressSeconds)||r.progressSeconds<0||!integer(r.progressBytes)||
      typeof r.started!=='boolean'||typeof r.resumed!=='boolean'||
      ![null,'recovery_tracking_expired','successor_lost_or_ambiguous','successor_changed'].includes(r.disarmed)||
      !Array.isArray(r.known)||r.known.length>8||r.known.some(v=>typeof v!=='string')||
      ![r.old,r.successor].every(v=>v===null||typeof v==='string'))throw Error('snapshot_review');
    if(r.previous){exact(r.previous,['t','bytes','readMs']);if(!finite(r.previous.t)||!integer(r.previous.bytes)||
      !finite(r.previous.readMs)||r.previous.readMs<0)throw Error('snapshot_review');}
    if(r.fast){exact(r.fast,['id','at']);if(typeof r.fast.id!=='string'||!finite(r.fast.at))throw Error('snapshot_review');}
    p.review.s=copy(r);
  }
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
  const seen=pairs(x.seen,p.review?1024:256);
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
__factories["src/autonomous/long-evidence"]=function(module,exports,require){
'use strict';
const owner=require('./ownership');
const {byteLength}=require('../core/runner');
const {explain}=require('../policy/decision-evidence');
const fresh=()=>({version:1,timeline:[],decisions:[],decisionsDropped:0,lastDecisionKey:null,
  lastObservedBytes:0,retiredGenerations:0,generations:[],maxSavedBytes:0});
function observe(s,f,d,compact,pipeline){
  const e=s.longEvidence,t=f.received_ms,index=Math.floor((t-s.runStartedMs)/300000);
  let bin=e.timeline.at(-1);
  if(!bin||bin.index!==index){
    if(s.continuous){e.timeline=e.timeline.filter(b=>b.index>index-288);}
    else if(e.timeline.length>=291)throw Error('timeline_capacity');
    bin={index,startMs:t,endMs:t,samples:0,bytes:0,download:0,waiting:0,uncertain:0,
      eligible:0,maxRate:0,rateSum:0,rateSamples:0,maxReadMs:0};e.timeline.push(bin);
  }
  bin.endMs=t;bin.samples++;bin.bytes+=Math.max(0,f.point.observed_received_bytes-e.lastObservedBytes);
  e.lastObservedBytes=f.point.observed_received_bytes;
  bin[f.point.state==='DOWNLOAD'?'download':f.point.state==='UNCERTAIN'?'uncertain':'waiting']++;
  if(d.row)bin.eligible++;
  if(Number.isFinite(f.point.phase_rate_Bps)){
    bin.maxRate=Math.max(bin.maxRate,f.point.phase_rate_Bps);bin.rateSum+=f.point.phase_rate_Bps;bin.rateSamples++;
  }
  bin.maxReadMs=Math.max(bin.maxReadMs,f.read_ms);
  // Bounded excerpts include protected candidates, not just dispatched actions.
  const coreRecovery=['start_one_recovery_observation','bounded_recovery_observation'].includes(f.point.decision_reason);
  const interesting=coreRecovery||f.point.candidate||d.row||['start_executor_recovery_observation',
    'bounded_executor_recovery_observation','recent_fast_dip_confirmation','recovery_rescue_budget_exhausted'].includes(d.reason);
  const key=interesting?`${d.reason}/${coreRecovery?f.point.decision_reason:''}/${f.point.main_id}/${f.point.low_since_s}`:null;
  if(key&&key!==e.lastDecisionKey){
    e.decisions.push({atMs:t,reason:d.reason,eligible:!!d.row,point:compact,
      explanation:explain(pipeline,f,d),
      before:s.recent.filter((_,i)=>i%4===0).slice(-8)});
    if(e.decisions.length>24){e.decisions.shift();e.decisionsDropped++;}
  }
  e.lastDecisionKey=key;
}
function boundAction(a){
  // Keep decisions and the complete action ledger. Decimate only sample detail,
  // explicitly count omitted points, and preserve excerpt endpoints.
  while(byteLength(JSON.stringify(a))>8192){
    const name=a.followup.length>=a.before.length?'followup':'before',rows=a[name];
    if(rows.length<=2)throw Error('action_record_capacity');
    const smaller=rows.filter((_,i)=>i===0||i===rows.length-1||i%2===0);
    a.detailSamplesOmitted=(a.detailSamplesOmitted||0)+rows.length-smaller.length;a[name]=smaller;
  }
}
function retire(s,store,owned,keep=2){
  const e=s.longEvidence;
  while(e.generations.length>keep){
    const generation=e.generations[0];
    if(store.read(owner.HEAD)!==owned||generation===s.generation)throw Error('retention_head_changed');
    const key=owner.key(generation,'state'),old=owner.parse(store.read(key));
    if(old.retired!==true&&((!old.closed&&!(Number.isSafeInteger(old.sessionDeadlineMs)&&s.sessionStartedMs>=old.sessionDeadlineMs))||old.terminal||old.runId!==s.runId||old.codeId!==s.codeId))
      throw Error('retention_state_mismatch');
    const raw=JSON.stringify({version:1,retired:true,generation,runId:s.runId,
      copiedInto:s.generation,reason:'normal_handoff_payload_compacted'});
    if(store.write(key,raw)!==true||store.read(key)!==raw)throw Error('retention_write_failed');
    // Splitter race/door registers, root, flags, and action accounting are never cleared.
    e.generations.shift();e.retiredGenerations++;
  }
}
function validate(e){
  if(!e||e.version!==1||!Array.isArray(e.timeline)||e.timeline.length>291||
    !Array.isArray(e.decisions)||e.decisions.length>24||!Array.isArray(e.generations)||e.generations.length>3||
    e.generations.some(x=>!Number.isSafeInteger(x)||x<0)||
    !['decisionsDropped','retiredGenerations','maxSavedBytes','lastObservedBytes'].every(k=>Number.isFinite(e[k])&&e[k]>=0))
    throw Error('invalid_long_evidence');
}
module.exports={fresh,observe,boundAction,retire,validate};

};
__factories["src/autonomous/diagnostics"]=function(module,exports,require){
'use strict';
// Evidence only. No decision gates, network calls or automatic fault attribution.
const LIMIT=32;
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const fresh=()=>({version:1,faults:[],faultsDropped:0,faultCounts:{},maxSavedGap:null});
const TYPES=['session_interrupted','read_failure','terminal_fault','engine_rebaseline'];
function validate(d){
  if(!d||d.version!==1||!Array.isArray(d.faults)||d.faults.length>LIMIT||!integer(d.faultsDropped)||
    !d.faultCounts||Object.keys(d.faultCounts).some(k=>!TYPES.includes(k)||!integer(d.faultCounts[k]))||
    Object.values(d.faultCounts).reduce((a,b)=>a+b,0)!==d.faults.length+d.faultsDropped)
    throw Error('invalid_diagnostic_ledger');
  for(const f of d.faults){
    if(!TYPES.includes(f.type)||!integer(f.detectedMs)||!integer(f.generation)||
      typeof f.sessionId!=='string'||f.sessionId.length>80||
      typeof f.reason!=='string'||!/^[a-z_]{1,80}$/.test(f.reason)||
      !['lastCheckpointMs','lastSuccessfulReadMs','previousDeadlineMs','expectedEngine','observedEngine']
        .every(k=>f[k]===null||integer(f[k])))throw Error('invalid_diagnostic_fault');
  }
  const g=d.maxSavedGap;
  if(g!==null&&(!integer(g.fromMs)||!integer(g.toMs)||g.toMs<=g.fromMs||g.gapMs!==g.toMs-g.fromMs||
    !integer(g.generation)||typeof g.sessionId!=='string'||g.sessionId.length>80||
    !['previousCheckpointMs','previousSuccessfulReadMs'].every(k=>g[k]===null||integer(g[k]))||
    !['same_session','normal_handoff','interrupted_handoff'].includes(g.context)))
    throw Error('invalid_diagnostic_gap');
  return d;
}
function fault(d,type,s,t,reason,extra={}){
  if(!TYPES.includes(type))throw Error('invalid_diagnostic_type');
  d.faultCounts[type]=(d.faultCounts[type]||0)+1;
  d.faults.push({type,detectedMs:t,generation:s.generation,sessionId:s.sessionId,reason,
    lastCheckpointMs:extra.lastCheckpointMs??s.updatedMs??null,
    lastSuccessfulReadMs:s.lastSuccessfulReadMs??null,
    previousDeadlineMs:extra.previousDeadlineMs??null,
    expectedEngine:s.streamId??null,observedEngine:extra.observedEngine??null});
  if(d.faults.length>LIMIT){d.faults.shift();d.faultsDropped++;}
  validate(d);
}
function gap(d,s,fromMs,toMs,context,previousCheckpointMs){
  if(fromMs===null||toMs<=fromMs||(d.maxSavedGap&&toMs-fromMs<=d.maxSavedGap.gapMs))return;
  // Use successful-read end timestamps, not rounded speeds or invented zeroes.
  // Across an interruption the first endpoint is a *saved* checkpoint; this is
  // not proof the process/network was down for the whole interval.
  d.maxSavedGap={fromMs,toMs,gapMs:toMs-fromMs,generation:s.generation,sessionId:s.sessionId,
    context,previousCheckpointMs,previousSuccessfulReadMs:fromMs};
  validate(d);
}
const normalReasons=new Set(['normal_yield','trial_complete','trial_complete_after_handoff',
  'trial_complete_after_interruption','operator_stop','local_stop','no_target_within_wait_budget']);
module.exports={LIMIT,fresh,validate,fault,gap,isFault:reason=>!normalReasons.has(reason)};

};
__factories["src/autonomous/rolling-budget"]=function(module,exports,require){
'use strict';
// Pure rolling ledger used by the continuous runtime allowance.
// A reservation consumes capacity even if dispatch/reply is subsequently unknown.
// The caller must persist and read back `next` under exclusive ownership BEFORE
// dispatch. Never create a fresh ledger merely because a run/session changed.
const WINDOW_MS=86400000,MAX_LIMIT=100;
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&
  Object.keys(x).sort().join()===keys.slice().sort().join();
function validate(s){
  if(!exact(s,['version','scope','limit','windowMs','observedMs','totalReserved','entries'])||s.version!==1||
    typeof s.scope!=='string'||!/^[a-z0-9-]{8,80}$/.test(s.scope)||!integer(s.limit)||s.limit<1||s.limit>MAX_LIMIT||
    s.windowMs!==WINDOW_MS||!integer(s.observedMs)||!integer(s.totalReserved)||
    !Array.isArray(s.entries)||s.entries.length>s.limit||s.entries.length>s.totalReserved)
    throw Error('invalid_rolling_budget');
  let lastTime=null;
  for(let i=0;i<s.entries.length;i++){
    const e=s.entries[i];
    if(!exact(e,['sequence','reservedMs'])||!integer(e.sequence)||
      e.sequence!==s.totalReserved-s.entries.length+i+1||!integer(e.reservedMs)||
      e.reservedMs>s.observedMs||(lastTime!==null&&e.reservedMs<lastTime))
      throw Error('invalid_rolling_budget_entry');
    lastTime=e.reservedMs;
  }
  return s;
}
function fresh(scope,now,limit=MAX_LIMIT){
  return validate({version:1,scope,limit,windowMs:WINDOW_MS,observedMs:now,totalReserved:0,entries:[]});
}
function advance(s,now){
  validate(s);
  if(!integer(now)||now<s.observedMs)throw Error('rolling_budget_clock_rollback');
  // The interval is (now - 24h, now]. An attempt releases its slot exactly when
  // it reaches 24h, independently of local midnight or the current worker.
  return {...s,observedMs:now,entries:s.entries.filter(e=>now-e.reservedMs<WINDOW_MS).map(e=>({...e}))};
}
function view(s,now){
  const n=advance(s,now);
  return {scope:n.scope,limit:n.limit,windowMs:n.windowMs,used:n.entries.length,remaining:n.limit-n.entries.length,
    totalReserved:n.totalReserved,nextReleaseMs:n.entries.length?n.entries[0].reservedMs+n.windowMs:null};
}
function prepareReservation(s,now,expectedSequence){
  const next=advance(s,now);
  // A lost acknowledgement cannot turn a retried reservation into another slot.
  if(!integer(expectedSequence)||expectedSequence!==next.totalReserved+1)
    throw Error('rolling_budget_sequence_mismatch');
  if(next.entries.length>=next.limit)return {allowed:false,next,reason:'rolling_budget_exhausted'};
  next.totalReserved=expectedSequence;
  const reservation={sequence:expectedSequence,reservedMs:now};next.entries.push(reservation);
  validate(next);return {allowed:true,next,reservation,reason:'reserved_requires_durable_commit'};
}
module.exports={WINDOW_MS,MAX_LIMIT,fresh,validate,advance,view,prepareReservation};

};
__factories["src/autonomous/allowance"]=function(module,exports,require){
'use strict';
const rolling=require('./rolling-budget');
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const copy=x=>JSON.parse(JSON.stringify(x));
function grants(g){
  if(!g||g.version!==1||!integer(g.sequence)||!Array.isArray(g.entries)||g.entries.length>8)throw Error('invalid_grants');
  let last=0;
  for(const x of g.entries){
    if(!integer(x.sequence)||x.sequence<=last||x.sequence>g.sequence||!integer(x.count)||x.count<1||x.count>100||
      !integer(x.issuedMs)||!integer(x.expiresMs)||x.expiresMs<=x.issuedMs||x.expiresMs-x.issuedMs>86400000||
      typeof x.id!=='string'||!/^[a-f0-9]{32}$/.test(x.id))throw Error('invalid_grant');
    last=x.sequence;
  }
  return g;
}
function fresh(scope,t){return {version:1,base:rolling.fresh(scope,t),totalReserved:0,grantSequence:0,uses:[]};}
function validate(s){
  if(!s||s.version!==1||!integer(s.totalReserved)||!integer(s.grantSequence)||!Array.isArray(s.uses)||s.uses.length>8)
    throw Error('invalid_allowance');
  rolling.validate(s.base);
  if(s.totalReserved<s.base.totalReserved)throw Error('invalid_allowance_total');
  let last=0;
  for(const u of s.uses){
    grants({version:1,sequence:s.grantSequence,entries:[u]});
    if(u.sequence<=last||!integer(u.used)||u.used>u.count)throw Error('invalid_grant_usage');last=u.sequence;
  }
  return s;
}
function sync(s,g,t){
  validate(s);grants(g);
  if(g.sequence<s.grantSequence)throw Error('grant_ledger_rollback');
  const next=copy(s);next.base=rolling.advance(s.base,t);
  for(const u of s.uses){
    const match=g.entries.find(x=>x.sequence===u.sequence);
    if(t<u.expiresMs&&(!match||['id','count','issuedMs','expiresMs'].some(k=>match[k]!==u[k])))
      throw Error('active_grant_changed');
  }
  next.uses=g.entries.filter(x=>t<x.expiresMs).map(x=>{
    const old=s.uses.find(u=>u.sequence===x.sequence);
    if(x.issuedMs>t||(!old&&x.sequence<=s.grantSequence))throw Error('unaccounted_grant');
    return {...x,used:old?.used??0};
  });next.grantSequence=g.sequence;return validate(next);
}
function view(s,t){
  validate(s);const base=rolling.view(s.base,t),extra=s.uses.filter(u=>t<u.expiresMs);
  return {base,extra:extra.map(u=>({...u,remaining:u.count-u.used})),
    remaining:base.remaining+extra.reduce((n,u)=>n+u.count-u.used,0),totalReserved:s.totalReserved,
    grantSequence:s.grantSequence};
}
function reserve(s,t){
  const next=copy(validate(s));next.base=rolling.advance(s.base,t);const v=view(next,t);
  if(!v.remaining)return {allowed:false,next};
  let source;
  if(v.base.remaining){const r=rolling.prepareReservation(next.base,t,next.base.totalReserved+1);next.base=r.next;source={kind:'base',sequence:r.reservation.sequence};}
  else {const u=next.uses.filter(u=>t<u.expiresMs&&u.used<u.count).sort((a,b)=>a.expiresMs-b.expiresMs||a.sequence-b.sequence)[0];
    u.used++;source={kind:'grant',id:u.id,sequence:u.sequence,used:u.used,expiresMs:u.expiresMs};}
  next.totalReserved++;if(!integer(next.totalReserved))throw Error('allowance_counter_capacity');
  return {allowed:true,next,source};
}
module.exports={fresh,validate,grants,sync,view,reserve};

};
__factories["src/autonomous/continuous"]=function(module,exports,require){
'use strict';
const owner=require('./ownership'),allowance=require('./allowance');
const integer=x=>Number.isSafeInteger(x)&&x>=0;
function validateBinding(b,validate){
  if(typeof b.budgetScope!=='string'||!/^[a-z0-9-]{16,64}$/.test(b.budgetScope)||
    !(b.durationMs===null||integer(b.durationMs)&&b.durationMs<=86400000)||
    !(b.maxAttempts===null||integer(b.maxAttempts)&&b.maxAttempts<=100)||
    (b.durationMs===null)!==(b.expiresMs===null)||b.mode==='diagnostic')throw Error('invalid_continuous_binding');
  const normalized={...b,profile:'long-v1',durationMs:b.durationMs??86400000,
    expiresMs:b.expiresMs??b.notBeforeMs+86400000,maxAttempts:b.maxAttempts??(b.mode==='observe'?0:100)};
  delete normalized.budgetScope;delete normalized.engineRecovery;
  if('engineRecovery' in b&&!['auto','pause'].includes(b.engineRecovery))throw Error('invalid_engine_recovery');
  validate(normalized);return b;
}
function fresh(b,parent,t){
  if(parent?.continuous){
    const c=parent.continuous;
    if(c.scope!==b.budgetScope||c.target!==b.host||c.device!==b.deviceName||
      c.faultLocked||!parent.terminal)throw Error('continuous_budget_locked_or_scope_changed');
    allowance.validate(c.allowance);
    return {...JSON.parse(JSON.stringify(c)),actionsDropped:0,actionGcThrough:0,inheritedActionAt:parent.pipeline.own.actionAt,runBaseTotal:c.allowance.totalReserved};
  }
  return {version:1,scope:b.budgetScope,target:b.host,device:b.deviceName,
    allowance:allowance.fresh(b.budgetScope,t),runBaseTotal:0,actionsDropped:0,
    actionGcThrough:0,inheritedActionAt:null,ownerGcThrough:parent?.generation??-1,faultLocked:false};
}
function validateState(c,b){
  if(!c||c.version!==1||c.scope!==b.budgetScope||c.target!==b.host||c.device!==b.deviceName||
    typeof c.faultLocked!=='boolean'||!['runBaseTotal','actionsDropped','actionGcThrough'].every(k=>integer(c[k]))||
    !(c.ownerGcThrough===-1||integer(c.ownerGcThrough))||c.actionGcThrough>c.actionsDropped||
    !(c.inheritedActionAt===null||Number.isFinite(c.inheritedActionAt)&&c.inheritedActionAt>=0)||
    c.allowance?.base?.scope!==c.scope)throw Error('invalid_continuous_ledger');
  allowance.validate(c.allowance);return c;
}
function pruneActions(s){
  while(s.actions.length>100){const a=s.actions[0];
    if(a.status!=='reply_received_effect_unverified'||a.startedMs===null||s.updatedMs-a.startedMs<5000)throw Error('cannot_retire_open_action');
    s.actions.shift();s.continuous.actionsDropped++;
  }
}
function gc(s,store,owned){
  const c=s.continuous;
  const del=k=>{if(store.read(owner.HEAD)!==owned)throw Error('retention_head_changed');
    if(store.read(k)!==null&&(store.write(k,null)!==true||store.read(k)!==null))throw Error('retention_delete_failed');};
  // The already-committed index no longer references these pages.
  while(c.actionGcThrough<c.actionsDropped){del(owner.pageKey(s.runId,c.actionGcThrough+1));c.actionGcThrough++;}
  while(c.ownerGcThrough<s.generation-2){
    const g=c.ownerGcThrough+1,raw=store.read(owner.key(g,'state'));
    // Retain earlier completed runs for the control-plane export retention.
    if(raw!==null){const old=owner.parse(raw);
      if(old.runId!==s.runId){c.ownerGcThrough=g;continue;}
      if(!old.closed&&!(integer(old.sessionDeadlineMs)&&s.sessionStartedMs>=old.sessionDeadlineMs))throw Error('cannot_retire_live_owner');
    }
    for(const suffix of ['state','race','door'])del(owner.key(g,suffix));c.ownerGcThrough=g;
  }
}
module.exports={validateState,validateBinding,fresh,pruneActions,gc};

};
__factories["src/autonomous/runtime"]=function(module,exports,require){
'use strict';
const {Pipeline,fingerprint}=require('../pipeline');
const {endpoint}=require('../core/adapter');
const {byteLength}=require('../core/runner');
const ownership=require('./ownership');
const snapshots=require('./snapshot');
const evidence=require('./long-evidence');
const diagnostics=require('./diagnostics');
const continuous=require('./continuous'),allowance=require('./allowance');
const {explain}=require('../policy/decision-evidence');
const schedule=require('./schedule');
const PERIOD=schedule.periodMs,RESERVE=schedule.reserveMs,MAX_STATE=524288;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const copy=x=>JSON.parse(JSON.stringify(x));
function validate(b){
  if(b?.profile==='continuous-v1')return continuous.validateBinding(b,validate);
  const keys=['enabled','runId','mode','host','deviceName','expectedBuild','expectedModel','notBeforeMs',
    'latestStartMs','expiresMs','durationMs','referenceMs','tailMs','maxAttempts','diagnostic'];
  if(b&&Object.prototype.hasOwnProperty.call(b,'waitTargetMs'))keys.push('waitTargetMs');
  const extended=b?.profile==='long-v1';
  if(b&&Object.prototype.hasOwnProperty.call(b,'profile'))keys.push('profile');
  if(!b||Object.keys(b).sort().join()!==keys.sort().join()||b.enabled!==true||
    !/^[a-z0-9-]{16,80}$/.test(b.runId)||!['observe','execute','diagnostic'].includes(b.mode)||
    typeof b.host!=='string'||!b.host.split('.').every(x=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(x))||
    b.host.length>253||b.host.indexOf('.')<1||typeof b.deviceName!=='string'||b.deviceName.length<1||b.deviceName.length>64||
    typeof b.expectedBuild!=='string'||!/^\d{1,10}$/.test(b.expectedBuild)||
    typeof b.expectedModel!=='string'||b.expectedModel.length>64||!b.expectedModel.length||
    !['notBeforeMs','latestStartMs','expiresMs','durationMs','referenceMs','tailMs','maxAttempts'].every(k=>integer(b[k]))||
    b.latestStartMs<=b.notBeforeMs||b.latestStartMs-b.notBeforeMs>300000||
    ('profile' in b&&!extended)||
    b.expiresMs<=b.latestStartMs||b.expiresMs-b.notBeforeMs>(extended?86400000:1200000)||
    b.durationMs<5000||b.durationMs>(extended?86400000:900000)||b.referenceMs+b.tailMs>=b.durationMs||
    b.maxAttempts>(extended?schedule.longMaxAttempts:schedule.finiteMaxAttempts)||
    (b.mode==='observe'&&b.maxAttempts!==0)||(b.mode==='execute'&&b.maxAttempts<1)||
    ('waitTargetMs' in b&&(!integer(b.waitTargetMs)||(extended?b.waitTargetMs!==0:b.waitTargetMs<1000||b.waitTargetMs>300000)))||
    (extended&&(b.mode==='diagnostic'||b.expiresMs!==b.notBeforeMs+b.durationMs)))
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
  if(s.diagnostics)diagnostics.validate(s.diagnostics);
  const cont=b.profile==='continuous-v1';
  if(cont){continuous.validateState(s.continuous,b);
    if(s.continuous.ownerGcThrough>s.generation)throw Error('invalid_retention_cursor');
    if(s.continuous.allowance.totalReserved-s.continuous.runBaseTotal!==s.attemptsReserved)throw Error('allowance_action_mismatch');}
  if(s.version!==1||!['samples','candidates','eligible','attemptsReserved','invocations','sessions'].every(k=>integer(s[k]))||
    (b.maxAttempts!==null&&s.attemptsReserved>b.maxAttempts)||s.invocations>s.attemptsReserved||!Array.isArray(s.actions)||
    s.actions.length+(cont?s.continuous.actionsDropped:0)!==s.attemptsReserved||!Array.isArray(s.recent)||s.recent.length>64||
    !Array.isArray(s.events)||s.events.length>96||!Array.isArray(s.sessionHistory)||
    s.sessionHistory.length+(s.sessionHistoryDropped||0)!==s.sessions||
    !integer(s.runStartedMs)||!integer(s.updatedMs)||s.updatedMs<s.runStartedMs||
    !(s.originMs===null||integer(s.originMs))||!(s.actionsDisabled===null||s.actionsDisabled==='operator_observe'))
    throw Error('invalid_handoff_ledger');
  if(b.profile==='long-v1'||cont){
    evidence.validate(s.longEvidence);
    if(!s.pipeline.review||!integer(s.sessionHistoryDropped)||s.sessionHistory.length>16)
      throw Error('invalid_long_handoff');
  }
  let last=null;
  for(let i=0;i<s.actions.length;i++){
    const a=s.actions[i];
    if(a.sequence!==i+1+(cont?s.continuous.actionsDropped:0)||!integer(a.startedMs)||!integer(a.completedMs)||a.completedMs<a.startedMs||
      a.completedMs>s.updatedMs||a.status!=='reply_received_effect_unverified'||
      (last!==null&&a.startedMs-last<5000))throw Error('unsafe_handoff_action');
    last=a.startedMs;
  }
  if(s.invocations!==s.actions.length+(cont?s.continuous.actionsDropped:0)||s.pipeline?.own?.actionAt!==(last===null?(cont?s.continuous.inheritedActionAt:null):last/1000))
    throw Error('handoff_action_clock_mismatch');
  if(b.profile==='long-v1'||cont){
    const r=s.pipeline.review,a=s.actions.at(-1);
    if(r.actionAt!==(last===null?(cont?s.continuous.inheritedActionAt:null):last/1000)||
      (a&&(r.old!==fingerprint(a.connection)||
        (a.decision.reason==='stalled_own_successor'&&!r.resumed&&r.rescues!==1))))
      throw Error('handoff_recovery_ledger_mismatch');
  }
}
function start(o){
  const b=o.binding,cont=b?.profile==='continuous-v1';let ended=false,owned=null,state=null,pipeline=null,pending=null,token=0,lastClock=null;
  const done=(reason,extra={})=>o.done({reason,...extra});
  if(!b||b.enabled!==true){done('disabled');return;}
  validate(b);
  if(b.mode!=='observe'&&o.capabilities?.actionsQualified!==true){done('active_build_not_qualified');return;}
  if(!/^[A-Za-z0-9-]{1,80}$/.test(o.sessionId)||!/^[a-f0-9]{64}$/.test(o.codeId))throw Error('invalid_runtime_identity');
  const binding=JSON.stringify(b),store={read:o.readStore,write:(k,v)=>o.writeStore(v,k)};
  const flags={stop:ownership.PREFIX+'-'+b.runId+'-stop',observe:ownership.PREFIX+'-'+b.runId+'-observe'};
  function now(){const t=o.now();if(!integer(t)||(lastClock!==null&&t<lastClock))throw Error('clock_discontinuity');
    lastClock=t;return t;}
  const expiry=b.expiresMs??Number.MAX_SAFE_INTEGER,cap=b.maxAttempts??Number.MAX_SAFE_INTEGER;
  const begin=now();if(begin<b.notBeforeMs){done('outside_run_window');return;}
  const parent=ownership.head(store),same=parent.state?.runId===b.runId;
  if(parent.state?.continuous&&!cont){done('continuous_budget_requires_scoped_task');return;}
  if(cont&&typeof o.readGrants!=='function')throw Error('continuous_service_required');
  const budgetMarker=ownership.PREFIX+'-continuous-scope';
  if(cont&&!parent.state?.continuous&&store.read(budgetMarker)!==null)throw Error('continuous_budget_missing');
  const recovering=!!(same&&!parent.state.closed&&Number.isSafeInteger(parent.state.sessionDeadlineMs)&&
    begin>=parent.state.sessionDeadlineMs+schedule.takeoverGraceMs);
  if(begin>=expiry&&!recovering&&!(same&&parent.state.closed&&!parent.state.terminal)){done('outside_run_window');return;}
  const runKey=ownership.PREFIX+'-'+b.runId+'-root';
  if(!same&&store.read(runKey)!==null){done('run_cannot_be_reused');return;}
  if(same&&(parent.state.binding!==binding||parent.state.codeId!==o.codeId)){done('configuration_changed');return;}
  if(same&&parent.state.terminal){done('run_already_closed');return;}
  if(!same&&begin>b.latestStartMs){done('first_start_expired');return;}
  if(parent.state&&(!parent.state.closed&&!recovering||(!same&&!parent.state.terminal))){done('previous_worker_not_closed');return;}
  if(!same&&store.read(flags.stop)!==null){done('stop_flag');return;}
  if(same&&!recovering&&parent.state.reason!=='normal_yield'){done('unsafe_handoff');return;}
  let recoveryBlocked=false;
  if(recovering){
    const ps=parent.state;
    // Accounting was reserved durably before dispatch. Never replay an uncertain
    // action, even if the transport probably failed before sending it.
    recoveryBlocked=ps.actions.some(a=>a.status!=='reply_received_effect_unverified'||a.completedMs===null);
    ps.sessionHistory.push({sessionId:ps.sessionId,start:ps.sessionStartedMs,end:ps.sessionDeadlineMs,reason:'interrupted_session'});
    if(ps.longEvidence&&ps.sessionHistory.length>16){ps.sessionHistory.shift();ps.sessionHistoryDropped++;}
  }
  if(same){
    if(parent.state.sessions>=(cont?Number.MAX_SAFE_INTEGER:b.profile==='long-v1'?Math.ceil(b.durationMs/PERIOD)+2:16)||begin<parent.state.updatedMs){done('handoff_limit_or_clock');return;}
    if(!recoveryBlocked)validateHandoff(parent.state,b);
    pipeline=snapshots.restore(parent.state.pipeline);
  }else pipeline=cont&&parent.state?.continuous?snapshots.restore(parent.state.pipeline):new Pipeline(b.profile??null);
  if(cont){if(!pipeline.sampling)pipeline.enableWaitSampling();pipeline.sampling.resetCadence();}
  const sessionStart=begin,sessionDeadline=Math.min(expiry,Math.floor(begin/PERIOD)*PERIOD+PERIOD-RESERVE);
  // A final sub-second slice needs only a metadata closure, not another read.
  // Keep the old refusal for a short *non-final* cron slice.
  const finalShortSlice=same&&(b.profile==='long-v1'||cont)&&expiry>=begin&&
    expiry-begin<1000&&expiry-sessionDeadline<=RESERVE;
  if(begin<expiry&&!recovering&&sessionDeadline-begin<1000&&!finalShortSlice){done('insufficient_session_budget');return;}
  const claim=ownership.begin(store,parent,b.runId,o.sessionId,o.codeId,h=>{
    if(cont&&!parent.state?.continuous){
      const marker=JSON.stringify({scope:b.budgetScope,host:b.host,device:b.deviceName});
      if(store.read(budgetMarker)!==null||store.write(budgetMarker,marker)!==true||store.read(budgetMarker)!==marker)
        throw Error('continuous_bootstrap_unconfirmed');
    }
    if(!same){
      if(store.read(runKey)!==null||store.write(runKey,JSON.stringify(h))!==true)
        throw Error('run_root_write_failed');
    }
    const fresh={version:1,binding,runStartedMs:begin,originMs:null,sessions:0,sessionHistory:[],samples:0,
      candidates:0,eligible:0,attemptsReserved:0,invocations:0,actions:[],events:[],recent:[],gateReasons:{},
      states:{},maxReadMs:0,maxIntervalMs:0,lastSampleMs:null,streamId:cont?parent.state?.streamId??null:null,actionsDisabled:null,
      lastSuccessfulReadMs:null,readFailures:0,readErrors:0,recoveries:0,lastFault:null,
      diagnostics:diagnostics.fresh()};
    if(b.profile==='long-v1'||cont)Object.assign(fresh,{originMs:begin,sessionHistoryDropped:0,longEvidence:evidence.fresh()});
    if(cont)fresh.continuous=same?null:continuous.fresh(b,parent.state,begin);
    const s=same?copy(parent.state):fresh;
    if(!s.diagnostics)s.diagnostics=diagnostics.fresh();
    if(recovering)diagnostics.fault(s.diagnostics,'session_interrupted',s,begin,'interrupted_session',
      {previousDeadlineMs:s.sessionDeadlineMs});
    return {...s,...h,closed:false,terminal:false,reason:null,updatedMs:begin,sessionStartedMs:begin,
      sessionDeadlineMs:sessionDeadline,recoveries:(s.recoveries||0)+(recovering?1:0),
      lastFault:recovering?'interrupted_session':s.lastFault,sessions:s.sessions+1,phase:'starting',pipeline:snapshots.capture(pipeline)};
  },recovering?begin:null);
  if(!claim.accepted){done(claim.reason);return;}
  owned=claim.header;state=claim.state;
  if(cont&&!state.samplingCounts)state.samplingCounts={baselineSamples:state.samples,fast:0,waiting:0,absent:0};
  if(state.longEvidence)state.longEvidence.generations.push(state.generation);
  const encode=ownership.writer(store);
  let nextCheckpoint=begin+schedule.checkpointMs,signalCheck=null,cachedStop=null,cachedObserve=null,lastFrame=null;
  let observedEngine=null,lastPersistedMs=begin,grantCheck=null;
  function event(type,fields={}){state.events.push({atMs:now(),type,...fields});if(state.events.length>96)state.events.shift();}
  function signals(force=false){
    const t=now();if(force||signalCheck===null||t-signalCheck>=1000){
      cachedStop=store.read(flags.stop);cachedObserve=store.read(flags.observe);signalCheck=t;
      if(cont&&(grantCheck===null||t-grantCheck>=1000)){
        state.continuous.allowance=allowance.sync(state.continuous.allowance,o.readGrants(),t);grantCheck=t;}}
    if(cachedObserve!==null)state.actionsDisabled='operator_observe';
    return cachedStop!==null;
  }
  function persist(){
    if(store.read(ownership.HEAD)!==owned)throw Error('ownership_changed');
    if(cont)continuous.pruneActions(state);
    state.pipeline=snapshots.capture(pipeline);state.updatedMs=now();
    if(state.longEvidence){
      for(const a of state.actions)if(!a.__sealedExcerpt)evidence.boundAction(a);
      state.longEvidence.maxSavedBytes=Math.max(state.longEvidence.maxSavedBytes,byteLength(JSON.stringify(state))+16);
    }
    const raw=encode(state);if(byteLength(raw)>MAX_STATE)throw Error('evidence_capacity');
    const k=ownership.key(state.generation,'state');
    if(store.write(k,raw)!==true||store.read(k)!==raw)throw Error('state_write_failed');
    lastPersistedMs=state.updatedMs;
  }
  function finish(reason,handoff=false){
    if(ended)return;ended=true;token++;pending=null;
    state.closed=true;state.terminal=!handoff;state.reason=reason;state.phase=handoff?'handoff':'ended';
    state.endedMs=o.now();state.sessionHistory.push({sessionId:o.sessionId,start:sessionStart,end:state.endedMs,reason});
    if(state.longEvidence&&state.sessionHistory.length>16){state.sessionHistory.shift();state.sessionHistoryDropped++;}
    state.events.push({atMs:state.endedMs,type:'session_closed',reason});if(state.events.length>96)state.events.shift();let saved=false;
    try{
      if(diagnostics.isFault(reason)){
        if(cont)state.continuous.faultLocked=true;
        state.lastFault=reason;
        diagnostics.fault(state.diagnostics,'terminal_fault',state,state.endedMs,reason,
          {lastCheckpointMs:lastPersistedMs,observedEngine});
      }
      persist();if(cont){continuous.gc(state,store,owned);persist();}
      else if(state.longEvidence){evidence.retire(state,store,owned,handoff?2:1);persist();}saved=true;
    }
    catch(_){/* Incomplete ownership remains blocked. Never reset the splitter. */}
    done(reason,{saved,closed:true,terminal:state.terminal,samples:state.samples,invocations:state.invocations});
  }
  function guard(fn){if(ended)return;try{fn();}catch(e){finish(e&&/^[a-z_]{1,80}$/.test(e.message)?e.message:'runtime_error');}}
  function later(fn,delay){o.schedule(()=>guard(fn),Math.max(1,delay));}
  function yieldOrFinish(){
    // A wall-clock deadline can coincide with a cron boundary. Close in the
    // final 300 ms reserve instead of leaving a handoff nobody may resume.
    const final=(b.profile==='long-v1'||cont)&&expiry-sessionDeadline<=RESERVE;
    finish(final?'trial_complete':'normal_yield',!final);
  }
  function phase(t){
    if(state.originMs===null)return 'awaiting_download';
    const elapsed=t-state.originMs;return elapsed<b.referenceMs?'reference':elapsed<(b.durationMs??Number.MAX_SAFE_INTEGER)-b.tailMs?'actions':
      elapsed<(b.durationMs??Number.MAX_SAFE_INTEGER)?'tail':'ended';
  }
  function mayAct(reserved=false){
    // signals can advance the durable allowance clock. Admission must use time
    // read after that refresh, never the earlier measurement timestamp.
    const stopped=signals(true),t=now();return !stopped&&!ended&&o.capabilities?.actionsQualified===true&&b.mode!=='observe'&&
    !state.actionsDisabled&&(reserved?state.attemptsReserved<=cap:state.attemptsReserved<cap)&&
    (!cont||(!state.continuous.faultLocked&&(reserved||allowance.view(state.continuous.allowance,t).remaining>0)))&&phase(t)==='actions'&&
    t<expiry&&t<sessionDeadline&&store.read(ownership.HEAD)===owned;}
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
      if(a.startedMs===null||row[0]<=a.startedMs||row[0]-a.startedMs>(state.longEvidence?30000:20000)||
        (a.followupEndMs!==null&&row[0]>=a.followupEndMs))continue;
      if(a.followup.length<102&&(!a.followup.length||row[0]-a.followup.at(-1)[0]>=(state.longEvidence?390:190)))a.followup.push(row);
    }
  }
  function diagnostic(f){
    const d=b.diagnostic,p=f.point,r=f.targets.find(r=>r.id===d.id&&r.started===d.started&&r.engine===d.engine);
    if(!r||p.main_id!==r.id||!f.unique_main||p.reliable_read!==true||p.protected||p.state!=='DOWNLOAD'||
      !(p.main_delta_bytes>0&&p.main_delta_bytes>=p.current_growth_floor_bytes)||
      !f.startup.startup_permits_retry||!f.rearm.retry_allowed)return {row:null,reason:'diagnostic_waiting_exact_active_main'};
    return {row:r,reason:'explicit_single_diagnostic_not_low_speed'};
  }
  function action(f,d,first){
    if(!mayAct())return false;
    const before=[];for(const r of state.recent)if(!before.length||r[0]-before.at(-1)[0]>=190)before.push(r);
    const a={sequence:state.attemptsReserved+1,connection:{...d.row},pre_action_targets:f.targets,
      reservedMs:now(),startedMs:null,completedMs:null,status:'reserved_unknown',kind:b.mode,
      decision:{point:f.point,startup:f.startup,rearm:f.rearm,reason:d.reason,
        explanation:explain(pipeline,f,d,first)},before:before.slice(-33),
      followup:[],followupEndMs:null,effectConfirmedMs:null,firstThresholdMs:null,successors:[]};
    if(cont){const reservation=allowance.reserve(state.continuous.allowance,now());
      if(!reservation.allowed)return false;state.continuous.allowance=reservation.next;a.allowance=reservation.source;}
    state.actions.push(a);state.attemptsReserved++;event('action_reserved',{sequence:a.sequence});persist();
    const allowed=mayAct(true),t=now();
    if(!allowed||(a.allowance?.kind==='grant'&&t>=a.allowance.expiresMs)||t>=sessionDeadline||t>=expiry||t-f.received_ms<0||t-f.received_ms>250){finish('reserved_dispatch_cancelled');return true;}
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
  function readFailure(reason){
    pipeline.sampling?.lost();
    pending=null;state.readFailures=(state.readFailures||0)+1;state.readErrors=(state.readErrors||0)+1;
    state.lastFault=reason;event('read_failed',{reason,consecutive:state.readFailures});
    diagnostics.fault(state.diagnostics,'read_failure',state,now(),reason,{lastCheckpointMs:lastPersistedMs});
    // Every retry occurs after a genuine >0.5 s gap. Existing ingest quarantine
    // rebuilds the speed baseline; own-action clocks and rescue budget survive.
    if(state.readFailures>schedule.readRetryMs.length){finish('read_retry_exhausted');return;}
    persist();later(tick,schedule.readRetryMs[state.readFailures-1]);
  }
  function tick(){
    const t=now();if(store.read(ownership.HEAD)!==owned){finish('ownership_changed');return;}
    if(signals()){finish('operator_stop');return;}
    if(t>=expiry||phase(t)==='ended'){finish('trial_complete');return;}
    if(state.originMs===null&&t-state.runStartedMs>=(b.waitTargetMs??120000)){finish('no_target_within_wait_budget');return;}
    if(t>=sessionDeadline){yieldOrFinish();return;}
    const generation=++token;let replied=false;
    later(()=>{if(!replied&&generation===token){replied=true;token++;readFailure('read_timeout');}},schedule.readTimeoutMs);
    try{o.api('GET','/v1/requests/active',null,payload=>guard(()=>{
      if(replied||generation!==token)return;replied=true;const end=now();
      if(end>=expiry||phase(end)==='ended'){finish('trial_complete');return;}
      if(end>=sessionDeadline){yieldOrFinish();return;}
      if(!payload||!Array.isArray(payload.requests)){readFailure('invalid_requests_shape');return;}
      state.readFailures=0;
      const relevant=payload.requests.filter(r=>{const dest=endpoint(r.URL);return dest&&dest.host===b.host&&dest.port===443&&
        r.local===true&&r.deviceName===b.deviceName&&r.completed===false&&r.failed===false;});
      if(relevant.some(r=>!['TCP','HTTPS'].includes(r.method)))throw Error('unexpected_target_transport');
      if(state.streamId===null&&relevant.length){const ids=new Set(relevant.map(r=>r.engineIdentifier));
        if(ids.size!==1||![...ids].every(integer))throw Error('ambiguous_stream_identity');state.streamId=[...ids][0];}
      const engineIds=new Set(relevant.map(r=>r.engineIdentifier));
      observedEngine=engineIds.size===1&&integer([...engineIds][0])?[...engineIds][0]:null;
      if(cont&&b.engineRecovery==='auto'&&observedEngine!==null&&state.streamId!==null&&observedEngine!==state.streamId){
        diagnostics.fault(state.diagnostics,'engine_rebaseline',state,end,'engine_changed_rebaseline',
          {observedEngine,lastCheckpointMs:lastPersistedMs});
        const old=pipeline,ownPending=old.own.actionAt!==null&&end/1000-old.own.actionAt<5;
        pipeline=new Pipeline('continuous-v1');Object.assign(pipeline.own,old.own);
        pipeline.enableWaitSampling(old.sampling?.s??null);pipeline.sampling.resetCadence();
        pipeline.review.s={...old.review.s,disarmed:'successor_lost_or_ambiguous',successor:null,previous:null,
          quietAt:null,fast:null,hadTarget:ownPending,emptyAt:null,emptyLast:null,entryAt:null};
        if(ownPending)pipeline.startup.afterAction(old.own.actionAt);
        state.streamId=observedEngine;pending=null;
      }
      const f=pipeline.ingest(payload,t,end,state.streamId===null?undefined:state.streamId);lastFrame=f;
      diagnostics.gap(state.diagnostics,state,state.lastSuccessfulReadMs??null,end,
        state.samples===(same?parent.state.samples:0)?(recovering?'interrupted_handoff':same?'normal_handoff':'same_session'):'same_session',
        state.samples===(same?parent.state.samples:0)&&same?parent.state.updatedMs:lastPersistedMs);
      state.lastSuccessfulReadMs=end;
      state.samples++;state.maxReadMs=Math.max(state.maxReadMs,f.read_ms);
      if(cont){const priorPeriod=f.sampling.periodMs;
        state.samplingCounts[priorPeriod===100?'fast':priorPeriod===200?'waiting':'absent']++;}
      if(state.lastSampleMs!==null)state.maxIntervalMs=Math.max(state.maxIntervalMs,f.time_s*1000-state.lastSampleMs);
      state.lastSampleMs=f.time_s*1000;state.states[f.point.state]=(state.states[f.point.state]||0)+1;
      if(f.point.candidate)state.candidates++;
      if(state.originMs===null&&f.point.reliable_read&&f.point.recently_productive){state.originMs=end;event('download_origin');}
      state.phase=phase(end);state.lastTargetCount=f.targets.length;state.lastTrafficState=f.point.state;record(f);
      const d=b.mode==='diagnostic'?diagnostic(f):pipeline.consider(f);
      state.gateReasons[d.reason]=(state.gateReasons[d.reason]||0)+1;if(d.row)state.eligible++;
      if(state.longEvidence)evidence.observe(state,f,d,compact(f),pipeline);
      if(d.row&&mayAct()){
        if(pending){
          const first=pending;
          const fresh=b.mode==='diagnostic'?(fingerprint(pending.row)===fingerprint(d.row)&&d.row.inBytes>pending.row.inBytes?
            d:{row:null}):pipeline.revalidate(pending,f,now());pending=null;
          if(fresh.row&&action(f,fresh,first))return;
        }else pending={row:d.row,reason:d.reason,receivedMs:end};
      }else pending=null;
      // Continuous-only stable-WAIT optimization. Revalidation and all recovery
      // stay fast; legacy finite profiles retain their original cadence.
      const period=pipeline.sampling?pipeline.sampling.next(f,pipeline,pending):f.targets.length?100:1000;
      if(end>=nextCheckpoint){persist();nextCheckpoint=end+schedule.checkpointMs;}
      later(tick,Math.min(Math.max(1,t+period-now()),Math.max(1,sessionDeadline-now())));
    }));}catch(_){if(!replied&&generation===token){replied=true;token++;readFailure('read_exception');}}
  }
  guard(()=>{if(recoveryBlocked){finish('interrupted_action_unknown');return;}
    if(begin>=expiry){finish(recovering?'trial_complete_after_interruption':'trial_complete_after_handoff');return;}
    if(finalShortSlice){later(yieldOrFinish,sessionDeadline-now());return;}
    event('session_started',{generation:state.generation});persist();
    if(cont){state.longEvidence.generations=state.longEvidence.generations.slice(-2);continuous.gc(state,store,owned);persist();}
    else if(state.longEvidence){evidence.retire(state,store,owned);persist();}tick();});
  return {inspect:()=>copy(state),lastFrame:()=>lastFrame,stop:()=>finish('local_stop')};
}
module.exports={start,validate,validateHandoff,compact,PERIOD,RESERVE};

};
__factories["src/autonomous/jobs"]=function(module,exports,require){
// Job protocol v2 extension: bounded execute tasks require an independently qualified build.
'use strict';
const owner=require('./ownership');
const schedule=require('./schedule');
const allowance=require('./allowance');
const PERIOD=schedule.periodMs;
const copy=x=>JSON.parse(JSON.stringify(x));
const canonical=x=>x===null||typeof x!=='object'?JSON.stringify(x):Array.isArray(x)?
  '['+x.map(canonical).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join()===keys.split(',').sort().join();
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const id=x=>typeof x==='string'&&/^[a-z0-9-]{16,64}$/.test(x);
function validateService(s){
  if(!exact(s,'protocol,installationId,host,deviceName,expectedBuild,expectedModel'+(s&&'layout' in s?',layout':'')+(s&&'budgetScope' in s?',budgetScope':'')+(s&&'engineRecovery' in s?',engineRecovery':''))||
    ('layout' in s&&!['single-worker-v1','diagnostic-pair-v1'].includes(s.layout))||
    ('budgetScope' in s&&(!id(s.budgetScope)||s.layout!=='single-worker-v1'))||
    ('engineRecovery' in s&&(!s.budgetScope||!['auto','pause'].includes(s.engineRecovery)))||s.protocol!==2||!id(s.installationId)||
    typeof s.host!=='string'||s.host.length>253||!s.host.includes('.')||
    !s.host.split('.').every(x=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(x))||
    typeof s.deviceName!=='string'||!s.deviceName.length||s.deviceName.length>64||
    typeof s.expectedBuild!=='string'||!/^\d{1,10}$/.test(s.expectedBuild)||
    typeof s.expectedModel!=='string'||!s.expectedModel.length||s.expectedModel.length>64)throw Error('invalid_service');
  return s;
}
function validateTask(t){
  if(t?.profile==='continuous-v1'){
    if(!integer(t.sequence)||t.sequence<1||Number(/-(\d+)$/.exec(t.runId)?.[1])!==t.sequence||t.kind==='probe'||
      !(t.durationMs===null||integer(t.durationMs)&&t.durationMs<=86400000)||
      (t.kind==='execute'&&!(t.maxAttempts===null||integer(t.maxAttempts)&&t.maxAttempts<=100)))throw Error('invalid_continuous_task');
    const n={...t,profile:'long-v1',durationMs:t.durationMs??86400000};delete n.sequence;
    if(t.kind==='execute')n.maxAttempts=t.maxAttempts??100;validateTask(n);return t;
  }
  const active=t?.kind==='execute';
  const extended=t?.profile==='long-v1';
  const keys='runId,kind,delayMs,startGraceMs,waitTargetMs,durationMs'+(active?',maxAttempts,referenceMs,tailMs':'')+
    (t&&'profile' in t?',profile':'');
  if(!exact(t,keys)||!id(t.runId)||
    !['observe','probe','execute'].includes(t.kind)||!['delayMs','startGraceMs','waitTargetMs','durationMs'].every(k=>integer(t[k]))||
    t.delayMs>86400000||t.startGraceMs<PERIOD||t.startGraceMs>1800000||
    ('profile' in t&&(!extended||t.kind==='probe'))||
    (t.kind!=='probe'&&(t.durationMs<5000||t.durationMs>(extended?86400000:900000)||
      (extended?t.waitTargetMs!==0:t.waitTargetMs<1000||t.waitTargetMs>300000||t.waitTargetMs+t.durationMs>1200000)))||
    (t.kind==='probe'&&(t.waitTargetMs!==0||t.durationMs!==PERIOD)))throw Error('invalid_task');
  if(active&&(!['maxAttempts','referenceMs','tailMs'].every(k=>integer(t[k]))||
    t.maxAttempts<1||t.maxAttempts>(extended?schedule.longMaxAttempts:schedule.finiteMaxAttempts)||
    t.referenceMs<60000||t.tailMs<60000||
    t.referenceMs+t.tailMs>=t.durationMs))throw Error('invalid_action_limits');
  return t;
}
function bindingFor(s,t,now){
  const end=t.durationMs===null?null:now+t.waitTargetMs+t.durationMs;
  return {enabled:true,runId:t.runId,mode:t.kind==='execute'?'execute':'observe',host:s.host,deviceName:s.deviceName,
    ...(t.profile?{profile:t.profile}:{}),...(t.profile==='continuous-v1'?{budgetScope:s.budgetScope,...(s.engineRecovery?{engineRecovery:s.engineRecovery}:{})}:{}),
    expectedBuild:s.expectedBuild,expectedModel:s.expectedModel,notBeforeMs:now,
    latestStartMs:Math.min(now+PERIOD,end===null?Number.MAX_SAFE_INTEGER:end-1),expiresMs:end,durationMs:t.durationMs,
    waitTargetMs:t.waitTargetMs,referenceMs:t.referenceMs??0,tailMs:t.tailMs??0,maxAttempts:t.kind==='execute'?t.maxAttempts:0,diagnostic:null};
}
function validateLedger(state,s){
  if(s.budgetScope){allowance.grants(state.grants);if(!integer(state.runSequence))throw Error('invalid_run_sequence');}
  if(state.retireJob){const j=state.retireJob;
    if(!exact(j,'runId,resultKey,generation,fromAction,toAction')||!id(j.runId)||
      !integer(j.fromAction)||!integer(j.toAction)||j.fromAction<1||j.toAction-j.fromAction>123||
      (j.resultKey===null?j.generation!==null:!integer(j.generation)||j.resultKey!==owner.key(j.generation,'state')))
      throw Error('invalid_retirement_record');
  }
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
  const prefix='vidhub-jobs-v2-'+(s.budgetScope||s.installationId);
  // Separate one-shot generations serialize control/admission across JSCs. No
  // expiring lock, blanket reset or automatic reuse of an interrupted claim.
  const map=k=>prefix+k.slice(owner.PREFIX.length);
  const store={read:k=>o.read(map(k)),write:(k,v)=>o.write(v,map(k))};
  const key=(run,suffix)=>prefix+'-'+run+'-'+suffix;
  const put=(k,v)=>{if(o.write(v,k)!==true||o.read(k)!==v)throw Error('job_write_unconfirmed');};
  function head(){
    const h=owner.head(store);
    const previous=h.state?JSON.parse(h.state.service):null;
    const upgrade=!!(s.budgetScope&&previous?.budgetScope===s.budgetScope&&
      canonical({...previous,installationId:s.installationId})===canonical(s)&&
      (!h.state.current||['finished','cancelled','expired'].includes(h.state.current.phase)));
    if(h.state&&((!upgrade&&(h.state.codeId!==o.codeId||h.state.service!==canonical(s)))||!integer(h.state.clockMs)||
      o.now()<h.state.clockMs))throw Error('job_service_or_clock_changed');
    if(h.state)validateLedger(h.state,s);
    return h;
  }
  function cleanup(h){
    const j=h.state?.retireJob;if(!j)return;
    const del=k=>{if(store.read(owner.HEAD)!==h.raw)throw Error('control_retention_head_changed');
      if(o.read(k)!==null&&(o.write(null,k)!==true||o.read(k)!==null))throw Error('control_retention_failed');};
    if(j.resultKey){const raw=o.read(j.resultKey);
      if(raw!==null){const old=owner.parse(raw);
        if(old.runId!==j.runId||!old.terminal||!old.closed)throw Error('retired_job_mismatch');
        if(owner.head({read:o.read},false).state?.generation===old.generation)throw Error('cannot_retire_current_head');
      }
      for(let i=j.fromAction;i<=j.toAction;i++)del(owner.pageKey(j.runId,i));
      for(let g=Math.max(0,j.generation-2);g<=j.generation;g++){
        const raw=o.read(owner.key(g,'state'));
        if(raw!==null&&owner.parse(raw).runId!==j.runId)continue;
        for(const suffix of ['state','race','door'])del(owner.key(g,suffix));
      }
    }
    for(const suffix of ['spec','cancel'])del(key(j.runId,suffix));
    for(const suffix of ['root','stop','observe'])del(owner.PREFIX+'-'+j.runId+'-'+suffix);
  }
  function transaction(fn){
    const h=head();if(s.budgetScope)cleanup(h);
    const state=h.state?copy(h.state):{current:null,history:[],...(s.budgetScope?{runSequence:0,grants:{version:1,sequence:0,entries:[]}}:{})};
    const next=fn(state); // All validation before consuming a one-shot claim.
    const claimed=owner.begin(store,h,s.installationId,o.sessionId,o.codeId,header=>({
      ...header,closed:true,terminal:true,service:canonical(s),clockMs:o.now(),current:next.current,history:next.history,...(s.budgetScope?{runSequence:next.runSequence,grants:next.grants,retireJob:next.retireJob??null}:{})}));
    if(!claimed.accepted)throw Error('job_control_busy');
    if(next.current?.task.profile==='long-v1'&&claimed.state.generation>=2){
      const k=owner.key(claimed.state.generation-2,'state'),raw=store.read(k);
      if(raw!==null){const prior=owner.parse(raw);
        if(prior.retired!==true&&(!prior.closed||!prior.terminal||prior.runId!==s.installationId||prior.codeId!==o.codeId))
          throw Error('control_retention_mismatch');
        const small=JSON.stringify({version:1,retired:true,generation:claimed.state.generation-2,
          runId:s.installationId,copiedInto:claimed.state.generation});
        if(store.read(owner.HEAD)!==claimed.header||store.write(k,small)!==true||store.read(k)!==small)
          throw Error('control_retention_failed');
      }
    }
    if(s.budgetScope&&claimed.state.generation>=2){
      for(const suffix of ['state','race','door']){const k=owner.key(claimed.state.generation-2,suffix);
        if(store.read(owner.HEAD)!==claimed.header||store.write(k,null)!==true||store.read(k)!==null)throw Error('control_retention_failed');}
    }
    if(s.budgetScope)cleanup({raw:claimed.header,state:claimed.state});
    return claimed.state;
  }
  let cachedHeader=null,cachedGrants=null;
  function readGrants(){const revision=store.read(owner.HEAD);
    if(revision!==cachedHeader||cachedGrants===null){const h=head();cachedHeader=h.raw;cachedGrants=h.state?.grants;allowance.grants(cachedGrants);}
    return cachedGrants;
  }
  return {head,transaction,key,put,readGrants};
}
function ownerIdentity(x){return typeof x==='string'&&/^[A-Za-z0-9-]{1,80}$/.test(x);}
function stopKey(run){return owner.PREFIX+'-'+run+'-stop';}
function runtimeState(o,j,details=true){
  if(j.resultKey){
    const s=owner.parse(o.read(j.resultKey));
    if(s.runId!==j.task.runId||(s.codeId!==o.codeId&&!s.continuous)||!s.closed||!s.terminal||
      canonical(JSON.parse(s.binding))!==canonical(j.binding))throw Error('job_saved_result_mismatch');
    return details?owner.hydrate({read:o.read},s):s;
  }
  const h=owner.head({read:o.read},details);
  if(!h.state||h.state.runId!==j.task.runId)return null;
  if((h.state.codeId!==o.codeId&&!(h.state.continuous&&h.state.closed&&h.state.terminal))||canonical(JSON.parse(h.state.binding))!==canonical(j.binding))throw Error('job_runtime_mismatch');
  if(o.read(owner.HEAD)!==h.raw)throw Error('job_runtime_head_changed');
  return h.state;
}
function status(s,o,runId=null,details=true){
  const c=context(s,o),h=c.head(),j=h.state?.current;
  const picked=runId&&j?.task.runId!==runId?h.state?.history.find(x=>x.task.runId===runId):j;
  if(!picked)return {status:runId?'unknown_job':'idle',job:null};
  const result=copy(picked);
  if(result.phase==='pending'&&o.now()>result.startByMs)result.phase='expired';
  let runtime=null;
  if(result.task.kind!=='probe'&&result.binding){
    runtime=runtimeState(o,result,details);
    if(runtime?.terminal&&runtime.closed){result.phase='finished';result.reason=runtime.reason;
      result.resultKey=owner.key(runtime.generation,'state');}
  }
  if(result.task.kind==='probe'&&result.probeAtMs!==null&&o.now()>result.probeAtMs+112000&&
    ['running','stopping'].includes(result.phase)){
    const a=o.read(c.key(result.task.runId,'done-a')),b=o.read(c.key(result.task.runId,'done-b'));
    result.phase='finished';result.reason=a==='probe_complete'&&b==='probe_complete'?'probe_records_ready':'probe_incomplete';
  }
  const health=runtime?owner.health(runtime,o.now()):null;
  if(health&&runtime.continuous?.allowance){
    health.quota=allowance.view(runtime.continuous.allowance,o.now());
    if(health.quota.remaining===0){
      health.actionsBlocked=true;
      if(['running','waiting_target','waiting_download','waiting_next_batch'].includes(health.state))health.state='quota_exhausted';
    }
  }
  const interrupted=health&&['interrupted','unresponsive','expired_awaiting_close'].includes(health.state);
  return {status:interrupted?'interrupted':result.phase,job:result,runtime,health,nowMs:o.now()};
}
const terminal=j=>['cancelled','expired','finished'].includes(j.phase);
function compactCompleted(s,o){
  const c=context(s,o),h=c.head();
  const closed=[...(h.state?.history||[]),h.state?.current].filter(j=>['long-v1','continuous-v1'].includes(j?.task.profile)&&j.resultKey&&terminal(j));
  // Keep the four newest completed long-run payloads. Older task summaries and
  // non-reusable run IDs remain; pre-long-v1 and other installations are untouched.
  for(const j of closed.slice(0,-4)){
    const old=owner.parse(o.read(j.resultKey));
    if(old.runId!==j.task.runId||(old.codeId!==o.codeId&&!old.continuous)||!old.closed||!old.terminal||
      canonical(JSON.parse(old.binding))!==canonical(j.binding))throw Error('completed_retention_mismatch');
    const active=owner.head({read:o.read},false);
    if(active.state?.generation===old.generation)throw Error('cannot_retire_current_head');
    if(old.evidenceRetired!==true){
    const summary={evidenceRetired:true,...(old.continuous?{continuous:{scope:old.continuous.scope},retiredPageRange:[(old.continuous.actionGcThrough||0)+1,old.attemptsReserved]}:{})};
    for(const key of ['version','generation','runId','codeId','binding','closed','terminal','reason','originMs',
      'samples','sessions','invocations','attemptsReserved','updatedMs'])summary[key]=old[key];
    const raw=JSON.stringify(summary);
    if(c.head().raw!==h.raw||o.write(raw,j.resultKey)!==true||o.read(j.resultKey)!==raw)
      throw Error('completed_retention_failed');
    }
    // A crash after index commit must not permanently skip page reclamation.
    // Index now refers to a summary; remove only this retired run's bounded pages.
    const range=old.retiredPageRange??(old.continuous?[(old.continuous.actionGcThrough||0)+1,old.attemptsReserved]:[1,schedule.longMaxAttempts]);
    for(let i=range[0];i<=range[1];i++){const k=owner.pageKey(old.runId,i);
      if(o.read(k)!==null&&(o.write(null,k)!==true||o.read(k)!==null))throw Error('evidence_retention_failed');}
  }
}
function archive(state,j){state.history.push(j);if(state.history.length>16)state.history.shift();}
function submit(s,o,t,replaces=null){
  validateTask(t);
  if(!!s.budgetScope!==(t.profile==='continuous-v1'))throw Error('continuous_scope_profile_mismatch');
  if(s.layout==='single-worker-v1'&&t.kind==='probe')throw Error('probe_requires_diagnostic_layout');
  if(s.layout==='diagnostic-pair-v1'&&t.kind!=='probe')throw Error('diagnostic_layout_only');
  if(t.kind==='execute'&&o.capabilities?.actionsQualified!==true)throw Error('active_build_not_qualified');
  if(replaces!==null&&!id(replaces))throw Error('invalid_replacement');
  const c=context(s,o),prior=c.head().state,existing=[prior?.current,...(prior?.history||[])].find(j=>j?.task.runId===t.runId);
  const spec=canonical(t),saved=o.read(c.key(t.runId,'spec'));
  if(existing){
    if(canonical(existing.task)!==spec)throw Error('run_id_payload_changed');
    return {...status(s,o,t.runId),duplicate:true};
  }
  if(t.profile==='continuous-v1'){const previous=owner.head({read:o.read},false).state;
    if(previous?.continuous&&(previous.continuous.faultLocked||previous.continuous.scope!==s.budgetScope))throw Error('continuous_budget_locked_or_scope_changed');}
  if(saved!==null)throw Error('run_id_retired_or_submission_unconfirmed');
  if(o.read(owner.PREFIX+'-'+t.runId+'-root')!==null)throw Error('run_id_already_used_by_runtime');
  // A committed head is the only admission source. A failed spec write poisons
  // this ID; never retry it as a fresh task and silently move its time window.
  const now=o.now();
  const next=c.transaction(state=>{
    if(s.budgetScope){if(t.sequence!==state.runSequence+1)throw Error('run_sequence_mismatch');state.runSequence=t.sequence;}
    let old=state.current;
    if(old){
      old=status(s,o,old.task.runId).job;
      if(replaces!==null){
        if(old.task.runId!==replaces||!['pending','expired'].includes(old.phase)||old.binding!==null)
          throw Error('only_pending_job_can_be_replaced');
        old.phase='cancelled';old.reason='rescheduled';
      }else if(!terminal(old))throw Error('previous_job_not_finished');
      archive(state,old);
      if(s.budgetScope&&state.history.length===16&&prior?.history?.length===16){
        const retired=prior.history[0],raw=retired.resultKey?o.read(retired.resultKey):null,r=raw?owner.parse(raw):null;
        state.retireJob={runId:retired.task.runId,resultKey:retired.resultKey??null,
          generation:r?.generation??null,fromAction:r?.retiredPageRange?.[0]??(r?.continuous?.actionGcThrough??0)+1,
          toAction:r?.retiredPageRange?.[1]??r?.attemptsReserved??0};
      }
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
  if(current.task.kind!=='probe'&&role==='peer')return {reason:'idle'};
  const view=status(s,o,null,false),j=view.job,now=o.now();
  if(!j||terminal({...j,phase:view.status})){
    if(j&&view.runtime?.closed&&view.runtime.terminal&&!terminal(current))complete(s,o,j.task.runId,view.runtime.reason);
    return {reason:'idle'};
  }
  if(j.task.kind!=='probe'&&role==='peer')return {reason:'idle'};
  if(['long-v1','continuous-v1'].includes(j.task.profile)&&role==='worker')compactCompleted(s,o);
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
  const state=c.transaction(state=>{
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
  if(['long-v1','continuous-v1'].includes(state.current.task.profile))compactCompleted(s,o);
  return state;
}
function control(q,o){
  if(!exact(q,'requestId,operation,service,codeId,task,runId,replaces')||!/^[a-f0-9]{32}$/.test(q.requestId)||
    !['submit','status','cancel','export','topup'].includes(q.operation)||q.codeId!==o.codeId)throw Error('invalid_job_request');
  const s=validateService(q.service);let result;
  if(o.environment.system!=='tvOS'||String(o.environment['surge-build'])!==s.expectedBuild||
    o.environment['device-model']!==s.expectedModel||o.scriptType!=='generic')throw Error('wrong_tv_environment');
  if(q.operation==='topup'){
    if(q.runId!==null||q.replaces!==null)throw Error('invalid_topup_request');
    result=topup(s,o,q.task);
  }else if(q.operation==='submit'){
    if(q.runId!==null)throw Error('invalid_job_request');result=submit(s,o,q.task,q.replaces);
  }else{
    if(q.task!==null||q.replaces!==null||(q.runId!==null&&!id(q.runId)))throw Error('invalid_job_request');
    result=q.operation==='cancel'?cancel(s,o,q.runId):status(s,o,q.runId,q.operation==='export');
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
        sessions:r.sessions,originMs:r.originMs,invocations:r.invocations,attemptsReserved:r.attemptsReserved,
        updatedMs:r.updatedMs,...(r.continuous?.allowance?{allowance:allowance.view(r.continuous.allowance,o.now()),faultLocked:r.continuous.faultLocked}:{}),
        ...(r.evidenceRetired?{evidenceRetired:true}:{})};}
  }
  if(s.budgetScope)result.grants=context(s,o).head().state?.grants??{version:1,sequence:0,entries:[]};
  return {requestId:q.requestId,operation:q.operation,...result};
}
function topup(s,o,g){
  if(!s.budgetScope||o.capabilities?.actionsQualified!==true)throw Error('continuous_topup_unavailable');
  if(!exact(g,'id,sequence,count,issuedMs,expiresMs'))throw Error('invalid_topup');
  allowance.grants({version:1,sequence:g.sequence,entries:[g]});
  const c=context(s,o),prior=c.head().state;
  if(!prior?.current||prior.current.task.kind!=='execute')throw Error('no_active_continuous_job');
  const existing=prior.grants.entries.find(x=>x.id===g.id);
  if(existing){if(canonical(existing)!==canonical(g))throw Error('grant_id_payload_changed');
    return {status:'grant_received',duplicate:true,grant:existing};}
  const now=o.now(),live=status(s,o,null,false);
  if(!['running','interrupted'].includes(live.status)||live.runtime?.terminal||live.runtime?.continuous?.faultLocked)
    throw Error('topup_cannot_enable_or_unlock');
  if(now<g.issuedMs||now-g.issuedMs>300000||now>=g.expiresMs)throw Error('topup_request_expired');
  const next=c.transaction(state=>{
    if(g.sequence!==state.grants.sequence+1)throw Error('grant_sequence_mismatch');
    const entries=state.grants.entries.filter(x=>x.expiresMs>now);
    if(entries.length>=8)throw Error('active_grant_capacity');
    state.grants={version:1,sequence:g.sequence,entries:[...entries,copy(g)]};return state;
  });return {status:'grant_received',received:true,duplicate:false,grant:copy(g),grants:next.grants};
}
module.exports={topup,PERIOD,canonical,validateService,validateTask,context,status,submit,cancel,admit,complete,control};

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
        now:o.now,schedule:o.schedule,readGrants:c.readGrants,readStore:o.read,writeStore:o.write,api:o.api,done:result=>{
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
        $cronexp!==__require('src/autonomous/schedule').cron)throw Error('configured_timer_required');
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
        typeof $trigger!=='undefined'||typeof $cronexp!=='string'||$cronexp!==__require('src/autonomous/schedule').cron)
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
