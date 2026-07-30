# Cloudflare

## 사용 이유

머스타드는 Cloudflare를 통해 다음과 같은 역할을 수행한다.

- DNS 관리
- SSL 인증서 제공
- WAF를 통한 악성 요청 차단
- 캐싱 및 CDN

Fediverse 서버는 일반적인 웹사이트와 달리
브라우저뿐만 아니라 다른 서버들의 ActivityPub 요청도
중요한 트래픽이므로 보안 기능 선택에 주의가 필요했다.

---

## 사용 기술

- Cloudflare DNS
- Universal SSL
- WAF
- Cache Rules

---

## 운영 중 발생한 문제

### Bot Fight Mode와 ActivityPub 충돌

러시아 프로파간다 계정과
AI 데이터 크롤러 대응을 위해
Cloudflare의 Bot Fight Mode를 활성화하였다.

그러나 이후 일부 인스턴스(예: voyager, fluffyshelter.day)와
연합이 정상적으로 이루어지지 않는 문제가 발생하였다.

증상

- 특정 인스턴스의 신규 툿이 수신되지 않음
- 상대 서버에서는 mustard.blog를 "응답 없음"으로 판단
- 일정 횟수 이상 실패 후 Delivery Stop 상태로 전환
- URL 직접 조회는 가능하지만 자동 연합은 중단

원인

Bot Fight Mode가
ActivityPub 서버 간 요청까지
자동으로 봇 트래픽으로 판단하여
차단한 것이 원인이었다.

해결

- Bot Fight Mode 비활성화
- 상대 서버에서 Delivery 재개
- AI Bot 차단은 WAF 규칙으로만 처리

---

## 운영을 통해 얻은 교훈

Cloudflare는 웹사이트를 보호하기 위한 기본 설정이
Fediverse와 항상 호환되는 것은 아니다.

ActivityPub는 브라우저가 아닌
서버 간 API 통신으로 동작하기 때문에
보안 기능을 적용할 때는
웹 서비스와 다른 기준으로 검토해야 한다.

가입 승인제만으로도 대부분의 악성 가입을 차단할 수 있었으며,
과도한 자동 봇 차단 기능은
연합을 저해할 수 있다는 점을 경험했다.
