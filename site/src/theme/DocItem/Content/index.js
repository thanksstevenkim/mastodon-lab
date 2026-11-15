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
  const featuredRunbook = docId === 'runbooks/upgrade';
  const featuredIncident = docId === 'incidents/014-nginx-restart-dns-failure-after-glibc-update-2026-11-13';
  // The initial prototype has English source Markdown only. Don't imply that
  // selecting Korean translates these full technical documents.
  const untranslated = ko && !String(metadata.source || '').includes('/i18n/ko/');

  return (
    <div className={'lab-doc lab-doc--' + category + (featuredRunbook ? ' lab-doc--upgrade-preview' : '')}>
      {label && <p className="lab-doc__eyebrow">{label[ko ? 1 : 0]}</p>}
      {untranslated && (
        <p className="lab-doc__translation">
          기술 문서 원문은 현재 영어입니다. 한국어 전체 번역은 제공되지 않습니다.
        </p>
      )}
      {featuredRunbook && (
        <header className="lab-doc__intro">
          <h1>{ko ? 'Mastodon 업그레이드 운영 절차' : 'Mastodon Upgrade Runbook'}</h1>
          <p>{ko ? '작업 전 조건과 실제 업그레이드 절차를 구분해서 읽을 수 있습니다.' : 'Read the prerequisite checklist before the complete upgrade procedure.'}</p>
        </header>
      )}
      {featuredIncident && (
        <header className="lab-doc__intro lab-doc__intro--incident">
          <p className="lab-doc__record-id">SUP-0014 · 2026.11.13</p>
          <h1>{ko ? 'Nginx 재시작 실패로 발생한 Cloudflare 521' : 'Cloudflare 521: Nginx restart and R2 DNS failure'}</h1>
          <p>{ko ? '웹 서비스는 복구되었지만 기존 Nginx→R2 S3 API 경로는 검증되지 않았습니다.' : 'Public web service restored; the legacy Nginx-to-R2 S3 API path remains unverified.'}</p>
        </header>
      )}
      {featuredRunbook && <RunbookPanel />}
      {featuredIncident && <IncidentTimeline />}
      <OriginalContent {...props} />
    </div>
  );
}
