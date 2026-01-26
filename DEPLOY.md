# 🚀 AI Trader 배포 가이드 (Deployment Guide)

핸드폰이나 외부에서 접속하려면 **24시간 켜져 있는 클라우드 서버**에 봇을 올려야 합니다.
가장 쉽고 추천하는 방법은 **Railway**를 사용하는 것입니다.

---

## 방법 1: Railway (가장 추천 & 쉬움)
서버 설정(Linux 명령어)을 몰라도 바로 올릴 수 있고, HTTPS 주소(예: `https://my-bot.up.railway.app`)를 자동으로 만들어줍니다.

### 1단계: GitHub에 코드 올리기
1. 현재 작업 중인 폴더(`AI Trader`)를 본인의 **GitHub Repository**에 업로드합니다.
   - `git init`
   - `git add .`
   - `git commit -m "first commit"`
   - `git push...` (본인 레포지토리 주소로)

### 2단계: Railway 프로젝트 생성
1. [Railway.app](https://railway.app/) 접속 및 로그인 (GitHub 계정으로 로그인).
2. **"New Project"** -> **"Deploy from GitHub repo"** 클릭.
3. 방금 올린 `AI Trader` 레포지토리를 선택합니다.

### 3단계: 변수 설정 (Variables)
Railway 대시보드에서 `Variables` 탭을 클릭하고, `.env.local`에 있던 내용을 모두 똑같이 입력해줍니다.
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `BINANCE_API_KEY`
- `BINANCE_API_SECRET`
- `GEMINI_PRO_API_KEY` (있으면)

### 4단계: 서비스 분리 (Web vs Worker)
이 봇은 "웹사이트"와 "매매 봇(워커)"이 따로 돌아가야 합니다.
Railway는 `docker-compose.yml`을 자동으로 인식하거나, 서비스를 하나 더 추가할 수 있습니다.

**가장 쉬운 설정법 (Railway 설정 파일 `railway.json` 생성):**
프로젝트 루트에 `railway.json` 파일을 만들고 아래 내용을 넣어 GitHub에 올리면, Railway가 알아서 두 개를 띄워줍니다. (또는 Railway UI에서 서비스 추가 가능)

> **팁**: 만약 복잡하면 **Docker Compose** 방식으로 배포하면 됩니다. Railway는 Docker Compose를 지원합니다.

### 5단계: 배포 완료 및 접속
- 배포가 끝나면 Railway가 `https://...up.railway.app` 같은 주소를 줍니다.
- 이 주소를 핸드폰 크롬/사파리에 입력하면 어디서든 내 봇을 볼 수 있습니다!

---

## 방법 2: VPS (Vultr / DigitalOcean / AWS) - 고수용
월 $5~6 정도로 저렴하지만, 직접 리눅스 명령어를 다뤄야 합니다.

1. 우분투(Ubuntu) 서버를 하나 빌립니다.
2. 서버에 접속(`ssh root@ip`)해서 `docker`와 `docker-compose`를 설치합니다.
3. 프로젝트 코드를 서버로 가져옵니다 (`git clone ...`).
4. 서버에 `.env` 파일을 생성하고 키 값을 넣습니다.
5. 명령어 한 방이면 끝납니다:
   ```bash
   docker-compose up -d --build
   ```
6. 서버 IP 주소(`http://123.45.67.89:3000`)로 접속하면 됩니다.

---

## 📝 추천
**초보자라면 무조건 [Railway](https://railway.app)를 추천합니다.**
유료(월 $5 정도)지만, 5분 만에 세팅이 끝나고 모바일 접속 주소까지 깔끔하게 나옵니다.
