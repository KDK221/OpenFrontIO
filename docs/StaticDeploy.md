# 열국쟁패 — 서버 없는 싱글플레이 배포 (소무소프트 웹게임)

혼자 하기는 브라우저 안에서 모두 돌아가므로(LocalServer + Web Worker), 게임 서버 없이
정적 파일만으로 서비스할 수 있다. 이 빌드에서는 "같이 하기"가 "준비 중" 안내로 바뀌고,
로비 목록·서버 목록 요청과 Turnstile·CrazyGames 스크립트를 불러오지 않는다.

## 1. 빌드 (내 PC)

```bash
git pull
npm run inst
npm run build-static
```

`static/` 폴더가 결과물이다. 마지막 줄에 파일 수와 용량이 나온다
(쓰지 않는 OpenFront 지도는 지워서 수십 MB 수준).

## 2. Cloudflare Pages에 올리기

처음 한 번:

```bash
npx wrangler@4 login
npx wrangler@4 pages project create cheonha-tongil --production-branch main
```

배포(업데이트할 때마다 이것만):

```bash
npm run build-static
npm run deploy-static
```

주소: `https://cheonha-tongil.pages.dev` — 브라우저에서 열어 혼자 하기가 되는지 먼저 확인.

왜 `play.somusoft.com/폴더/`(R2)가 아니라 Pages인가: 게임이 주소를 `/`와
`/game/<id>`로 바꾸기 때문에 **도메인의 맨 위(root)** 에서 서비스해야 한다. Pages는
모르는 경로에도 index.html을 돌려줘서 새로고침도 안전하다. 나중에 원하면 Pages에
사용자 도메인(예: `cheonha.somusoft.games`)을 붙이면 된다. 단, `*.somusoft.com`
하위 도메인은 소무소프트 웹게임 규칙상 등록할 수 없다(`play.somusoft.com`만 예외).

## 3. 소무소프트 웹게임에 등록

`https://somusoft.com/games/submit` (로그인 후)

| 항목        | 값                                                                                                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 제목        | 열국쟁패                                                                                                                                                          |
| 설명        | 삼국지·전국시대·춘추전국의 지도 위에서 천하를 다투는 실시간 영토 전략 게임. 시나리오 모드에서는 역사 속 나라의 수도에서 시작하고, 자유 모드에서는 원하는 곳에서 시작한다. 황금 들판을 차지하면 병력이 더 빨리 늘어난다. |
| 조작 방법   | 지도를 눌러 시작 위치를 고르고, 이웃 땅을 눌러 공격. 마우스 휠로 확대/축소, 드래그로 이동. 오른쪽 클릭(길게 누르기)으로 건설·외교 메뉴.                                       |
| 실행 주소   | `https://cheonha-tongil.pages.dev/`                                                                                                                                        |
| 대표 이미지 | `https://cheonha-tongil.pages.dev/cover.webp`                                                                                                                              |
| 장르        | 시뮬레이션 (simulation)                                                                                                                                                    |
| 제작 도구   | HTML5                                                                                                                                                                      |
| 지원 기기   | PC (모바일도 되지만 화면이 좁다)                                                                                                                                            |

운영자 계정으로 `/games/manage`에서 검토 → 공개.

## 소무소프트 iframe 안에서 알아둘 점

- 웹게임 iframe은 `allow-scripts allow-same-origin`이라 Web Worker·WebGL·저장(localStorage)은 된다.
- `allow-popups`가 없어서 게임 안 쿠팡 광고를 눌러도 새 창이 열리지 않는다. 옆 광고
  칸은 화면이 1280px 이상일 때만 보이므로 iframe 안에서는 보통 숨겨진다.
- 상업적으로 쓰기 전에 `proprietary/` 파일(로고·글꼴·음악)을 교체해야 한다(AGPL 추가 조항).
  `static/LICENSE`는 그대로 둔다.
