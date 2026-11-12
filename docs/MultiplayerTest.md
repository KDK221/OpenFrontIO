# 멀티플레이 테스트 (서버 없이, 내 PC로)

이 포크는 OpenFront 회사 API 없이 **자체 서버 모드**(selfHosted)로 돈다.
개발 서버(`npm run dev`)가 게임 서버까지 같이 켜므로, 내 PC가 곧 멀티 서버다.

- 서버 목록 API를 찾지 않고, 그 때문에 멀티 버튼이 꺼지지도 않는다.
- 랭크전은 API가 필요해서 숨겨진다. "방 만들기"와 "로비 입장"(방 코드)으로 한다.
- 로그인 없이 손님으로 들어간다(개발 모드는 로그인 대신 브라우저 ID를 받는다).

## 1. 내 PC 하나로 (창 두 개)

```bash
git pull
npm run inst
npm run dev
```

1. 열린 창(`http://localhost:9000`)에서 **같이 하기 → 방 만들기**. 방 코드가 나온다.
2. **시크릿 창**(Ctrl+Shift+N)이나 다른 브라우저로 `http://localhost:9000`을 연다.
   같은 창의 새 탭은 같은 사람으로 취급되니 꼭 시크릿 창/다른 브라우저로.
3. 두 번째 창에서 **로비 입장** → 방 코드 입력.
4. 첫 번째 창(방장)에서 시작.

## 2. 친구와 인터넷으로 (Cloudflare 임시 터널, 무료)

내 PC가 켜져 있는 동안만 된다. 끄면 주소도 사라진다.

1. cloudflared 설치 (한 번만):
   ```
   winget install --id Cloudflare.cloudflared
   ```
2. `npm run dev`를 켠 상태에서 **새 cmd 창**에:
   ```
   cloudflared tunnel --url http://localhost:9000
   ```
3. `https://xxxx-xxxx.trycloudflare.com` 같은 주소가 나온다. 친구에게 보낸다.
4. 내가 방을 만들고 방 코드를 친구에게 알려 준다 → 친구는 그 주소에서 로비 입장.

참고: 개발 모드라 첫 로딩이 조금 느릴 수 있다. 공개 서비스는 나중에 VPS로 옮긴다.

## 3. 원래 OpenFront API로 돌리고 싶을 때

`.env`에 `OPENFRONT_API=1` (자체 서버 모드 끔). 이 포크에는 API가 없으니 보통 쓸 일 없다.
