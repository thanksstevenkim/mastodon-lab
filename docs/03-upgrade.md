## 업그레이드 과정

1. cd ~/mastodon
2. git fetch upstream
3. git merge --no-ff vX.Y.Z
4. git push
5. docker build -t mustardkim/mastodon-mustard:vX.Y.Z .
6. docker build -f streaming/Dockerfile -t mustardkim/mastodon-mustard:vX.Y.Z-streaming .
7. docker tag mustardkim/mastodon-mustard:vX.Y.Z mustardkim/mastodon-mustard:latest
8. docker push mustardkim/mastodon-mustard:vX.Y.Z
9. docker push mustardkim/mastodon-mustard:latest
10. docker push mustardkim/mastodon-mustard:vX.Y.Z-streaming
11. cd /opt/mastodon
12. sudo nano docker-compose.yml
13. vA.B.C(Previous Version) -> vX.Y.Z
14. Save the modified version of docker-compose.yml
15. docker compose pull
16. docker compose down && docker compose up -d

## 트러블슈팅

### git fetch upstream 실패

- 원인 : 환경 변화 및 다양한 이유
- 결과 : git remote add upstream https://github.com/mastodon/mastodon.git
