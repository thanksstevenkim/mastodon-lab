import React, {useState} from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

// A UI aid, not a production readiness gate. The full runbook below remains authoritative.
const preparation = [
  ['Review all relevant upstream release notes.', '대상 버전까지의 릴리스 노트 검토'],
  ['Confirm current database and media backups.', '데이터베이스·미디어 백업 확인'],
  ['Record running image tags and preserve rollback images.', '현재 이미지 태그 기록 및 롤백 이미지 보존'],
  ['Confirm the required services, versions, and access.', '필요 서비스·버전·접근 권한 확인'],
];

export default function RunbookPanel() {
  const [done, setDone] = useState([]);
  const {i18n} = useDocusaurusContext();
  const ko = i18n.currentLocale === 'ko';

  function toggle(index) {
    setDone((previous) =>
      previous.includes(index) ? previous.filter((value) => value !== index) : [...previous, index],
    );
  }

  return (
    <section className="lab-panel lab-panel--runbook" aria-label={ko ? '운영 절차 확인 도구' : 'Runbook reading aid'}>
      <div className="lab-panel__topline">
        <span>{ko ? '운영 절차 · UI 실험' : 'RUNBOOK / EXPERIMENT'}</span>
        <span>{done.length} / {preparation.length}</span>
      </div>
      <h2>{ko ? '시작 전 확인' : 'Before you begin'}</h2>
      <p>
        {ko
          ? '아래 항목은 전체 사전 조건 중 일부만 추린 것입니다. 상세 조건은 원문 절차서를 확인하세요.'
          : 'A short reading aid based on selected preconditions. Review the complete source runbook below.'}
      </p>
      <progress value={done.length} max={preparation.length} aria-label={ko ? '체크리스트 진행도' : 'Checklist progress'} />
      <ul className="lab-checklist">
        {preparation.map((item, index) => (
          <li key={item[0]}>
            <label>
              <input type="checkbox" checked={done.includes(index)} onChange={() => toggle(index)} />
              <span>{ko ? item[1] : item[0]}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="lab-panel__disclaimer">
        {ko
          ? '화면 안에서만 동작하는 체크리스트입니다. 저장되지 않으며, 작업 완료나 배포 승인을 의미하지 않습니다.'
          : 'Local UI state only: no persistence, server changes, deployment approval, or completion verification.'}
      </p>
    </section>
  );
}
