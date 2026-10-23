'use strict';
const { today, nowTime } = require('./util');
const { autoAbsence, escalateIssues, iqamaAlerts } = require('./services');

// المهام الدورية: الغياب التلقائي، تصعيد البلاغات، تنبيهات الإقامة
function runJobs(db) {
  const d = today();
  return {
    absent: autoAbsence(db, d, nowTime()),
    escalated: escalateIssues(db),
    iqama: iqamaAlerts(db, d),
  };
}

function startJobs(db, everyMs = 60000) {
  const tick = () => {
    try {
      runJobs(db);
    } catch (e) {
      console.error('jobs', e);
    }
  };
  tick();
  return setInterval(tick, everyMs);
}

module.exports = { runJobs, startJobs };
