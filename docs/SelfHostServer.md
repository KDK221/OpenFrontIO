# 멀티플레이 서버 직접 운영하기 (Oracle Cloud 무료 서버)

이 포크는 OpenFront 회사 API 없이 도는 **자체 서버 모드**(`SELF_HOSTED=1`)가 있다.
서버 한 대에 게임 전체(페이지 + 멀티 서버)를 올리고, 플레이어는 로그인 없이
손님으로 들어온다. 방 만들기/방 코드 입장과 공개 로비가 된다. 랭크전·결제·꾸미기
상점처럼 API가 필요한 것은 꺼진다.

## 구성

```
브라우저 ──HTTPS──▶ Caddy (인증서 자동) ──▶ 게임 컨테이너 (nginx + node)
```

- `deploy/selfhost/docker-compose.yml`: 게임 컨테이너(OpenFront와 같은 Dockerfile) + Caddy
- `deploy/selfhost/install.sh`: 빈 Ubuntu 서버에 한 번 실행 — Docker 설치, 방화벽, 빌드, 실행
- `deploy/selfhost/update.sh`: 깃허브의 최신 코드로 다시 빌드·재시작

## 1. Oracle 서버 만들기

1. https://www.oracle.com/kr/cloud/free/ 가입. **홈 리전은 서울 또는 춘천** (나중에 못 바꿈).
2. Compute → Instances → **Create instance**
   - Image: **Canonical Ubuntu 24.04**
   - Shape: **Ampere → VM.Standard.A1.Flex**, OCPU 2 / 메모리 12GB
   - SSH keys: **Save private key** 로 키 파일 저장 (잃어버리면 접속 불가)
   - "Out of capacity"가 뜨면 시간을 두고 다시 시도하거나 OCPU 1 / 6GB로.
3. 만든 인스턴스 화면의 **Public IP address**를 적어 둔다.

## 2. 80·443 포트 열기 (Oracle 콘솔)

인스턴스 화면 → **Subnet** 링크 → **Security Lists** → Default Security List →
**Add Ingress Rules**:

| Source CIDR | IP Protocol | Destination Port Range |
| ----------- | ----------- | ---------------------- |
| `0.0.0.0/0` | TCP         | `80,443`               |

(서버 안의 방화벽은 install.sh가 연다.)

## 3. 서버에 접속 (Windows PowerShell)

```
ssh -i C:\Users\내이름\Downloads\ssh-key-xxxx.key ubuntu@<Public IP>
```

"UNPROTECTED PRIVATE KEY FILE" 오류가 나면 키 파일 권한을 나만 읽게 바꾼다:

```
icacls C:\Users\내이름\Downloads\ssh-key-xxxx.key /inheritance:r /grant:r "$($env:USERNAME):R"
```

## 4. 설치 (서버 안에서 한 줄)

```
curl -fsSL https://raw.githubusercontent.com/KDK221/OpenFrontIO/samguk-skeleton/deploy/selfhost/install.sh | bash
```

처음 빌드는 5~15분 걸린다. 끝나면 주소가 나온다:

```
Done. The game is at: https://123-45-67-89.sslip.io
```

`sslip.io`는 IP를 그대로 이름으로 바꿔 주는 무료 주소라 도메인 없이도 HTTPS가 된다.
내 도메인을 쓰려면 Cloudflare DNS에 A 레코드(서버 IP, **회색 구름 = DNS only**)를 만들고:

```
curl -fsSL https://raw.githubusercontent.com/KDK221/OpenFrontIO/samguk-skeleton/deploy/selfhost/install.sh | DOMAIN=play.내도메인 bash
```

## 5. 업데이트

코드를 고친 뒤(깃허브에 올라간 뒤) 서버에서:

```
~/game-server/deploy/selfhost/update.sh
```

진행 중인 게임은 재시작하면 끝나니 사람이 없을 때 한다.

## 문제 해결

```
cd ~/game-server/deploy/selfhost
sudo docker compose ps          # 둘 다 running 인지
sudo docker compose logs -f game   # 게임 서버 로그
sudo docker compose logs -f caddy  # 인증서 문제
```

- 주소가 안 열림: 2번(보안 목록)에서 80·443을 열었는지 확인.
- 인증서 오류: Caddy가 80번으로 확인 요청을 받아야 한다 — 역시 포트 문제가 대부분.

## 자체 서버 모드가 바꾸는 것 (코드)

`SELF_HOSTED=1`이면 (`src/server/ServerEnv.ts`의 `selfHosted()` / `hasApi()`):

- 브라우저의 persistent ID를 그대로 신원으로 받는다 (`jwt.ts`).
- 입장 확인(Turnstile·이름 검사), 구독 확인, 유료 대기열, 랭크 체크인, 꾸미기 목록
  가져오기, 게임 기록 보관을 건너뛴다.
- 페이지에 `selfHosted: true`를 넘겨 클라이언트도 API를 찾지 않는다.
