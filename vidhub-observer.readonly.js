// Publication candidate: internal GET observer only. No automatic disconnection.
// Missing, invalid, or disabled private arguments cause immediate exit.
(function () {
  'use strict';
  let __binding;
  try {
    if (typeof $argument !== 'string' || $argument.length > 4096) throw new Error();
    const input = JSON.parse(decodeURIComponent($argument));
    const allowed = ['enabled','bindingVerified','host','port','deviceName','scope','expectedBuild','trialId','latestStartMs','hardStopMs'];
    if (!input || Array.isArray(input) || typeof input !== 'object' ||
        Object.keys(input).sort().join() !== allowed.sort().join() ||
        input.enabled !== true || input.bindingVerified !== true || input.port !== 443 ||
        typeof input.host !== 'string' || input.host.length > 253 ||
        input.host !== input.host.toLowerCase() || input.host.indexOf('.') < 1 ||
        !input.host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
        !/[a-z]/.test(input.host) ||
        typeof input.deviceName !== 'string' || input.deviceName.length < 1 ||
        input.deviceName.length > 64 || input.deviceName.split('').some(ch => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127) ||
        typeof input.scope !== 'string' || !/^[a-z0-9-]{16,80}$/.test(input.scope) ||
        typeof input.expectedBuild !== 'string' || !/^[0-9]{1,10}$/.test(input.expectedBuild) ||
        typeof $environment !== 'object' || $environment.system !== 'tvOS' ||
        String($environment['surge-build']) !== input.expectedBuild) throw new Error();
    if (typeof input.trialId !== 'string' || !/^[a-z0-9-]{16,64}$/.test(input.trialId) ||
        !Number.isSafeInteger(input.latestStartMs) || !Number.isSafeInteger(input.hardStopMs) ||
        input.hardStopMs - input.latestStartMs !== 300000 ||
        Date.now() < input.latestStartMs - 1800000) throw new Error();
    __binding = Object.freeze(input);
  } catch (_) { $done({}); return; }

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

/* Bounded local evidence only. It cannot alter detector decisions or perform I/O. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VidHubEvidence = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LIMITS = Object.freeze({preMs: 3000, postMs: 2000, samples: 64, events: 12, bytes: 32768});
  const STATES = ['WAIT', 'SETTLING', 'DOWNLOAD', 'UNCERTAIN'];
  const REASONS = ['waiting_or_uncertain_or_protected', 'settling_no_candidate',
    'insufficient_speed_evidence', 'window_speed_recovered', 'already_recorded_this_episode',
    'confirming_low_speed', 'current_growth_not_substantial', 'bounded_recovery_observation',
    'start_one_recovery_observation', 'productive_low_speed_candidate', 'invalid_sample',
    'invalid_row', 'invalid_target_counter_or_id', 'invalid_target_status', 'target_capacity',
    'non_increasing_clock', 'counter_precision_limit', 'history_capacity'];
  const STATUSES = ['open', 'complete', 'sample_cap', 'trial_end', 'halted', 'post_gap'];
  const integer = n => Number.isSafeInteger(n) && n >= 0;
  const finite = n => typeof n === 'number' && Number.isFinite(n);
  const numeric = n => n === null || finite(n);
  const keys = (x, list) => x && !Array.isArray(x) && Object.keys(x).sort().join() === list.slice().sort().join();
  // Every persisted character is ASCII: fixed keys/enums plus numbers, never raw strings.
  const size = x => JSON.stringify(x).length;
  const number = n => finite(n) ? n : null;
  function validSample(s) {
    return Array.isArray(s) && s.length === 9 && finite(s[0]) && s[0] >= 0 &&
      finite(s[1]) && s[1] >= 0 && Array.isArray(s[2]) && s[2].length <= 8 &&
      s[2].every(p => Array.isArray(p) && p.length === 2 && p.every(integer)) &&
      new Set(s[2].map(p => p[0])).size === s[2].length &&
      Number.isInteger(s[3]) && s[3] >= 0 && s[3] < STATES.length &&
      Number.isInteger(s[4]) && s[4] >= 0 && s[4] <= 7 &&
      Number.isInteger(s[5]) && s[5] >= 0 && s[5] < REASONS.length &&
      numeric(s[6]) && numeric(s[7]) && (s[8] === null || integer(s[8]));
  }
  const ordered = rows => rows.length <= LIMITS.samples &&
    rows.every((s, i) => validSample(s) && (!i || s[0] > rows[i-1][0]));
  class Evidence {
    constructor(binding, originMs) {
      if (!binding || !integer(originMs)) throw new Error('invalid_evidence_origin');
      this.binding = binding;
      this.s = {version: 1, originMs, lastMs: null, seenCandidates: 0, droppedEvents: 0,
        omittedFrames: 0, ring: [], events: []};
    }
    restore(value) {
      try {
        const x = JSON.parse(JSON.stringify(value));
        if (!keys(x, Object.keys(this.s)) || size(x) > LIMITS.bytes || x.version !== 1 ||
            x.originMs !== this.s.originMs || !numeric(x.lastMs) ||
            (x.lastMs !== null && x.lastMs < 0) ||
            ![x.seenCandidates, x.droppedEvents, x.omittedFrames].every(integer) ||
            !Array.isArray(x.ring) || !ordered(x.ring) || !Array.isArray(x.events) ||
            x.events.length > LIMITS.events || x.seenCandidates !== x.droppedEvents + x.events.length) return false;
        for (let i = 0; i < x.events.length; i++) {
          const e = x.events[i];
          if (!keys(e, ['ordinal','atMs','preTruncated','status','decision','samples']) ||
              !integer(e.ordinal) || !e.ordinal || e.ordinal > x.seenCandidates ||
              (i && e.ordinal <= x.events[i-1].ordinal) || !finite(e.atMs) || e.atMs < 0 ||
              typeof e.preTruncated !== 'boolean' || !STATUSES.includes(e.status) ||
              !Array.isArray(e.decision) || e.decision.length !== 5 || !e.decision.every(numeric) ||
              !Array.isArray(e.samples) || !ordered(e.samples) ||
              !e.samples.some(s => s[0] === e.atMs && (s[4] & 1)) ||
              e.samples.some(s => s[0] > e.atMs + LIMITS.postMs + 500)) return false;
        }
        if ([...x.ring, ...x.events.flatMap(e => e.samples)].some(s => x.lastMs === null || s[0] > x.lastMs)) return false;
        this.s = x; return true;
      } catch (_) { return false; }
    }
    add(frame, point) {
      const s = this.s, b = this.binding;
      // Milliseconds retain the read midpoint, including half milliseconds.
      const atMs = frame && frame.time_s * 1000 - s.originMs;
      if (!finite(atMs) || atMs < 0 || !Array.isArray(frame.targets) || !point ||
          frame.targets.some(r => !r || typeof r !== 'object') ||
          (s.lastMs !== null && atMs <= s.lastMs)) {
        s.omittedFrames++; return;
      }
      const rows = frame.targets.filter(r => r.host === b.host && r.port === b.port &&
        r.local === true && r.deviceName === b.deviceName && r.completed === false && r.failed === false)
        .map(r => [r.id, r.inBytes]);
      const sample = [atMs, frame.read_ms, rows, STATES.indexOf(point.state),
        (point.candidate ? 1 : 0) | (point.protected ? 2 : 0) | (point.reliable_read ? 4 : 0),
        REASONS.indexOf(point.decision_reason), number(point.phase_rate_Bps),
        number(point.short_rate_Bps), point.main_id ?? null];
      if (!validSample(sample)) { s.omittedFrames++; return; }
      s.lastMs = atMs;
      s.ring.push(sample);
      while (s.ring.length > LIMITS.samples ||
          (s.ring.length > 1 && s.ring[1][0] <= atMs - LIMITS.preMs)) s.ring.shift();
      for (const e of s.events) {
        if (e.status !== 'open') continue;
        // A later callback after a long gap cannot fill missing post-event evidence.
        if (atMs > e.atMs + LIMITS.postMs + 500) { e.status = 'post_gap'; continue; }
        if (e.samples.length >= LIMITS.samples) { e.status = 'sample_cap'; continue; }
        e.samples.push(sample);
        if (atMs >= e.atMs + LIMITS.postMs) e.status = 'complete';
      }
      if (point.candidate) {
        s.seenCandidates++;
        s.events.push({ordinal: s.seenCandidates, atMs,
          preTruncated: s.ring[0][0] > atMs - LIMITS.preMs,
          status: 'open', decision: [number(point.elapsed_s), number(point.low_since_s),
            number(point.hold_until_s), number(point.main_delta_bytes), number(point.current_growth_floor_bytes)],
          samples: s.ring.slice()});
        if (s.events.length > LIMITS.events) { s.events.shift(); s.droppedEvents++; }
      }
    }
    finish(reason) {
      for (const e of this.s.events) if (e.status === 'open') e.status = reason === 'trial_end' ? 'trial_end' : 'halted';
    }
    snapshot(budget = LIMITS.bytes) {
      if (!integer(budget) || budget < 512) throw new Error('evidence_budget_too_small');
      budget = Math.min(budget, LIMITS.bytes);
      // Serialize only when a batch is saved, never on every 100 ms observation.
      // Evict complete contexts as units, with explicit counts; do not imply lost data exists.
      while (size(this.s) > budget && this.s.events.length) { this.s.events.shift(); this.s.droppedEvents++; }
      while (size(this.s) > budget && this.s.ring.length) this.s.ring.shift();
      return JSON.parse(JSON.stringify(this.s));
    }
  }
  return {Evidence, LIMITS, STATES, REASONS, STATUSES};
}));

/* Local candidate evidence wrapper. No connection-control API. */
(function () {
  'use strict';
  const started = Date.now();
  const periodMs = 30000, finishReserveMs = 300, minimumBudgetMs = 100;
  const nextBoundaryMs = (Math.floor(started / periodMs) + 1) * periodMs;
  const b = __binding, key = 'vidhub-trial-' + b.trialId;
  let finished = false, evidence = null, observedFrame = null;
  function done(reason) {
    if (finished) return;
    finished = true;
    if (reason) console.log(JSON.stringify({trial: true, reason}));
    $done();
  }
  function readState() {
    const raw = $persistentStore.read(key);
    if (raw === null) return null;
    if (typeof raw !== 'string' || VidHubRunner.byteLength(raw) > 65536) throw new Error();
    return JSON.parse(raw);
  }
  function writeState(value) {
    if (evidence) {
      const base = Object.assign({}, value, {audit: null});
      value.audit = evidence.snapshot(Math.min(32768, 65536 - VidHubRunner.byteLength(JSON.stringify(base)) - 64));
    }
    const raw = JSON.stringify(value);
    return VidHubRunner.byteLength(raw) <= 65536 &&
      $persistentStore.write(raw, key) === true && $persistentStore.read(key) === raw;
  }
  const session = typeof $script === 'object' && $script.sessionID;
  if (typeof session !== 'string' || session.length < 1 || session.length > 80 ||
      !Number.isSafeInteger(started) || started >= b.hardStopMs) { done('trial_expired_or_missing_session'); return; }
  let state, plannedEndMs, beforeClaimMs;
  try {
    state = readState();
    if (state === null) {
      if (started > b.latestStartMs) { done('trial_start_window_closed'); return; }
      state = {version: 2, trialId: b.trialId, scope: b.scope, startMs: started,
        endMs: Math.min(started + 300000, b.hardStopMs), runs: 0, lastEndMs: started,
        leaseUntilMs: 0, owner: null, halted: false, checkpoint: null, reports: [], audit: null};
    }
    const fields = ['version','trialId','scope','startMs','endMs','runs','lastEndMs',
      'leaseUntilMs','owner','halted','checkpoint','reports','audit'];
    if (!state || Object.keys(state).sort().join() !== fields.sort().join() ||
        state.version !== 2 || state.trialId !== b.trialId || state.scope !== b.scope ||
        !Number.isSafeInteger(state.startMs) || !Number.isSafeInteger(state.endMs) ||
        state.endMs !== Math.min(state.startMs + 300000, b.hardStopMs) ||
        !Number.isSafeInteger(state.lastEndMs) || !Number.isSafeInteger(state.leaseUntilMs) ||
        !Number.isInteger(state.runs) || state.runs < 0 || state.runs > 10 ||
        typeof state.halted !== 'boolean' || !Array.isArray(state.reports) || state.reports.length > 10 ||
        (state.owner !== null && typeof state.owner !== 'string') ||
        (state.checkpoint !== null && typeof state.checkpoint !== 'string')) throw new Error();
    if (state.halted || state.runs >= 10 || started >= state.endMs) { done('trial_complete'); return; }
    if (started < state.lastEndMs || started < state.startMs) { done('trial_clock_backwards'); return; }
    if (state.owner !== null) {
      // This is an observational guard, not an atomic cross-process lock.
      // A crashed/unfinished batch ends this trial; it is never silently taken over.
      done(started < state.leaseUntilMs ? 'trial_overlap_guard' : 'trial_unfinished_batch'); return;
    }
    evidence = new VidHubEvidence.Evidence(b, state.startMs);
    if (state.audit !== null && !evidence.restore(state.audit)) throw new Error();
    if (state.runs > 0 && state.audit === null) throw new Error();
    // A late cron launch gets a shorter batch, never a later slot boundary.
    // The reserve leaves time for checkpoint/report storage; it is not a speed window.
    plannedEndMs = Math.min(started + 29700, nextBoundaryMs - finishReserveMs,
      state.endMs, b.hardStopMs);
    beforeClaimMs = Date.now();
    if (!Number.isSafeInteger(beforeClaimMs) || beforeClaimMs < started) {
      done('trial_clock_backwards'); return;
    }
    if (plannedEndMs - beforeClaimMs < minimumBudgetMs) {
      done('trial_slot_budget_exhausted'); return;
    }
    state.runs++;
    state.owner = session;
    state.leaseUntilMs = started + 30000;
    if (!writeState(state)) { done('trial_storage_unavailable'); return; }
  } catch (_) { done('trial_invalid_storage'); return; }
  function releaseUnstarted(reason, halt) {
    try {
      const current = readState();
      if (!current || current.owner !== session || current.runs !== state.runs) {
        done('trial_ownership_changed'); return;
      }
      // Storage/setup may have consumed the slot. Leave no orphan owner or phantom run.
      state.runs--; state.owner = null; state.leaseUntilMs = 0;
      state.halted = halt;
      if (!writeState(state)) { done('trial_release_storage_failed'); return; }
      done(reason);
    } catch (_) { done('trial_release_storage_failed'); }
  }
  const schema = {verified: true, rowsPath: ['requests'], fields: {
    id: ['id'], url: ['URL'], inBytes: ['inBytes'], local: ['local'],
    deviceName: ['deviceName'], completed: ['completed'], failed: ['failed']
  }};
  const adapt = VidHubAdapter.create(schema);
  const latencies = [], intervals = [], states = {};
  let firstMidpoint = null, lastMidpoint = null, growth = 0, previousTotal = null;
  let savedCheckpoint = null;
  try {
    if (state.checkpoint) previousTotal = JSON.parse(JSON.parse(state.checkpoint).core).state.total;
  } catch (_) { previousTotal = null; }
  const previousReport = state.reports[state.reports.length - 1];
  function percentile(values, p) {
    if (!values.length) return null;
    const sorted = values.slice().sort((a,c) => a-c);
    return sorted[Math.round((sorted.length - 1) * p)];
  }
  try {
    // Measure the remaining budget after synchronous storage and setup, not before.
    const runnerStartedMs = Date.now();
    if (!Number.isSafeInteger(runnerStartedMs) || runnerStartedMs < beforeClaimMs) {
      releaseUnstarted('trial_clock_backwards', true); return;
    }
    const duration = plannedEndMs - runnerStartedMs;
    if (duration < minimumBudgetMs) {
      releaseUnstarted('trial_slot_budget_exhausted', false); return;
    }
    let firstClock = true;
    VidHubRunner.start({
      durationMs: duration, adaptive: false, checkpoint: state.checkpoint, scope: b.scope,
      // Anchor the unchanged runner's relative deadline to this measured start.
      // Clamp timers too, so its own initialization cannot push the deadline later.
      now: () => { if (firstClock) { firstClock = false; return runnerStartedMs; } return Date.now(); },
      schedule: (fn, delay) => setTimeout(fn, Math.max(0, Math.min(delay, plannedEndMs - Date.now()))),
      read: callback => {
        const begin = Date.now();
        if (begin >= plannedEndMs) { callback(new Error('trial_expired')); return; }
        let replied = false;
        $httpAPI('GET', '/v1/requests/active', null, result => {
          const end = Date.now();
          if (finished || replied) return;
          replied = true;
          if (!Number.isSafeInteger(end) || end < begin || end >= plannedEndMs) {
            callback(new Error('trial_clock_or_deadline')); return;
          }
          const midpoint = (begin + end) / 2;
          if (latencies.length < 300) latencies.push(end - begin);
          if (lastMidpoint !== null && intervals.length < 300) intervals.push(midpoint - lastMidpoint);
          if (firstMidpoint === null) firstMidpoint = midpoint;
          lastMidpoint = midpoint;
          try {
            const targets = adapt(result);
            observedFrame = {time_s: midpoint / 1000, read_ms: end - begin, targets};
            callback(null, targets);
          }
          catch (_) { callback(new Error('schema_error')); }
        });
      },
      onPoint: point => {
        if (observedFrame) evidence.add(observedFrame, point);
        states[point.state] = (states[point.state] || 0) + 1;
        if (Number.isSafeInteger(point.observed_received_bytes)) {
          if (previousTotal !== null) growth += Math.max(0, point.observed_received_bytes - previousTotal);
          previousTotal = point.observed_received_bytes;
        }
      },
      // Runner persistence is staged in memory and committed together with the trial report.
      save: checkpoint => { savedCheckpoint = checkpoint; return false; },
      done: summary => {
        try {
          const current = readState();
          if (!current || current.owner !== session || current.runs !== state.runs) {
            done('trial_ownership_changed'); return;
          }
          const report = Object.assign({}, summary, {run: state.runs, startedMs: started,
            runnerStartedMs, nextBoundaryMs, plannedEndMs,
            endedMs: Date.now(), firstMidpointMs: firstMidpoint, lastMidpointMs: lastMidpoint,
            handoffGapMs: previousReport && firstMidpoint !== null && previousReport.lastMidpointMs !== null
              ? firstMidpoint - previousReport.lastMidpointMs : null,
            states, receivedBytes: growth, apiP50Ms: percentile(latencies, .5), apiP95Ms: percentile(latencies, .95),
            intervalP50Ms: percentile(intervals, .5), intervalMaxMs: intervals.length ? Math.max(...intervals) : null});
          state.checkpoint = savedCheckpoint;
          state.lastEndMs = report.endedMs;
          state.owner = null; state.leaseUntilMs = 0;
          state.halted = summary.reason !== 'batch_complete';
          state.reports.push(report);
          if (state.halted || state.runs >= 10 || plannedEndMs >= state.endMs)
            evidence.finish(state.halted ? 'halted' : 'trial_end');
          // Actual durable persistence is separate from the runner's staged save.
          report.trialStatePersisted = true;
          if (!writeState(state)) { done('trial_report_storage_failed'); return; }
          console.log(JSON.stringify({trial: true, report})); done();
        } catch (_) { done('trial_report_failed'); }
      }
    });
  } catch (_) { done('trial_start_failed'); }
}());

}());
