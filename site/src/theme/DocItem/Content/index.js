import React from 'react';
import OriginalContent from '@theme-original/DocItem/Content';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import RunbookPanel from '@site/src/components/RunbookPanel';
import IncidentTimeline from '@site/src/components/IncidentTimeline';

const labels = {
  incidents: ['INCIDENT REPORT', '장애 기록'],
  runbooks: ['RUNBOOK', '운영 절차서'],
  'update-log': ['UPDATE LOG', '업데이트 기록'],
  operations: ['OPERATIONS JOURNAL', '운영 기록'],
};

export default function DocItemContentWrapper(props) {
  const {metadata} = useDoc();
  const {i18n} = useDocusaurusContext();
  const ko = i18n.currentLocale === 'ko';
  const docId = metadata.id || '';
  const category = docId.split('/')[0];
  const label = labels[category];
  // The initial prototype has English source Markdown only. Don't imply that
  // selecting Korean translates these full technical documents.
  const untranslated = ko && !String(metadata.source || '').includes('/i18n/ko/');

  return (
    <div className={'lab-doc lab-doc--' + category}>
      {label && <p className="lab-doc__eyebrow">{label[ko ? 1 : 0]}</p>}
      {untranslated && (
        <p className="lab-doc__translation">
          기술 문서 원문은 현재 영어입니다. 한국어 전체 번역은 제공되지 않습니다.
        </p>
      )}
      {docId === 'runbooks/upgrade' && <RunbookPanel />}
      {docId === 'incidents/014-nginx-restart-dns-failure-after-glibc-update-2026-11-13' && <IncidentTimeline />}
      <OriginalContent {...props} />
    </div>
  );
}
