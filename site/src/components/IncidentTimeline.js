import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

// Source: incidents/014-nginx-restart-dns-failure-after-glibc-update-2026-11-13.md
// Keep this hand-selected overview separate from the complete evidence table.
const events = [
  {
    time: '15:39:32',
    en: 'The unattended APT upgrade began.',
    ko: '무인 APT 업데이트 시작',
  },
  {
    time: '15:40:18',
    en: 'Nginx logged an upstream DNS resolution failure during restart.',
    ko: 'Nginx 재시작 과정에서 upstream DNS 확인 실패 기록',
  },
  {
    time: '15:40:27',
    en: 'The service stop timed out; systemd attempted to start Nginx.',
    ko: '서비스 중지 시간 초과 후 systemd에서 Nginx 시작 시도',
  },
  {
    time: '15:44:16',
    en: 'The operator manually restored Nginx service.',
    ko: '운영자가 수동으로 Nginx 서비스 복구',
  },
];

export default function IncidentTimeline() {
  const {i18n} = useDocusaurusContext();
  const ko = i18n.currentLocale === 'ko';

  return (
    <section className="lab-panel lab-panel--incident" aria-label={ko ? '장애 타임라인' : 'Incident timeline'}>
      <div className="lab-panel__topline">
        <span>SUP-0014 / {ko ? '장애 기록' : 'INCIDENT REPORT'}</span>
        <span>2026.11.13 · JST</span>
      </div>
      <h2>{ko ? '확인된 주요 시점' : 'Observed timeline'}</h2>
      <ol className="lab-timeline">
        {events.map((event) => (
          <li key={event.time}>
            <time dateTime={'2026-11-13T' + event.time + '+09:00'}>{event.time}</time>
            <p>{ko ? event.ko : event.en}</p>
          </li>
        ))}
      </ol>
      <p className="lab-panel__disclaimer">
        {ko
          ? '이 목록은 원본 기록의 일부 관측 시점만 요약합니다. 정확한 장애 시작 시각과 영향 범위는 측정되지 않았습니다.'
          : 'Selected observations, not a complete causal timeline. Exact outage start and full impact were not measured.'}
        {' '}
        <a href="#evidence-and-timeline">{ko ? '원본 근거 보기' : 'See complete evidence'}</a>
      </p>
    </section>
  );
}
