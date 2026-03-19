<div align="center">

# Codex Multi-Agent Monitor

**멀티 에이전트 실행을 30초 안에 파악하는 그래프 기반 디버깅 워크벤치**

[![Tauri 2](https://img.shields.io/badge/Tauri-2-blue?logo=tauri&logoColor=white)](https://v2.tauri.app)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-Stable-orange?logo=rust&logoColor=white)](https://www.rust-lang.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![CI](https://img.shields.io/badge/CI-Passing-34d399?logo=github-actions&logoColor=white)](../../actions)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-8891a0)](../../releases)

<br />

*"에이전트 5개가 동시에 돌았는데, 누가 뭘 하다가 어디서 막혔는지 모르겠다고요?"*
*"이 도구 한 번 켜보세요."*

<br />

<img src="docs/screenshots/hero-default.png" alt="Codex Multi-Agent Monitor - 3-Pane Layout" width="100%" />

</div>

---

## 이런 분들을 위해 만들었습니다

멀티 에이전트 시스템을 운영하다 보면 이런 순간들이 옵니다:

- "에이전트 10개가 동시에 돌았는데... 누가 누구에게 일을 넘긴 거야?"
- "여기서 30초나 기다린 이유가 뭐지?"
- "실패한 지점은 찾았는데, 그 전에 어떤 흐름이었는지 모르겠어"
- "로그 1만 줄을 스크롤하기 싫다"

Codex Multi-Agent Monitor는 이 혼란을 **인과관계 그래프 한 장**으로 정리합니다.

## 핵심 기능

### 인과관계 그래프 (Causal Graph)

에이전트 간의 spawn, handoff, transfer, merge 관계를 한눈에 파악합니다.
실패 경로는 빨간색으로, 대기 중인 노드는 노란색으로 — 시선이 자연스럽게 문제 지점으로 향합니다.

<img src="docs/screenshots/hero-errored-subagent.png" alt="에이전트 Spawn → 병렬 실행 → 에러 감지 그래프" width="100%" />

> *Orchestrator가 3개의 하위 에이전트를 spawn하고, 그 중 하나(Gibbs)가 Usage limit에 걸린 상황.*
> *나머지 Pasteur와 Hume은 정상 진행 중. 이 모든 것이 한 화면에.*

### 대규모 병렬 실행

에이전트가 10개든 100개든, 레인 기반 레이아웃이 모든 동시 실행을 정리합니다.

<img src="docs/screenshots/hero-dense-parallel.png" alt="10개 에이전트 병렬 실행 뷰" width="100%" />

### 즉각적인 에러 탐지

첫 번째 에러 지점으로 점프하고, 실패까지의 전체 경로를 역추적합니다.
Summary strip의 "First error" 점프 버튼 한 번이면 끝.

<img src="docs/screenshots/hero-failed-run.png" alt="에러 감지 및 실패 경로 추적" width="100%" />

### JSON Import & Live Watch

완료된 실행 기록을 JSON으로 import하거나, 실시간 실행을 live watch로 추적합니다.
민감 정보는 자동으로 마스킹되고, raw 데이터는 opt-in 방식으로만 저장합니다.

<img src="docs/screenshots/feature-import.png" alt="JSON Import 드로어" width="100%" />

### 반응형 레이아웃

데스크톱의 3-pane 레이아웃부터 모바일의 컴팩트 뷰까지.
좌측 레일과 인스펙터는 드래그로 리사이즈 가능합니다.

<details>
<summary>모바일 뷰 보기</summary>
<br />
<div align="center">
<img src="docs/screenshots/mobile-view.png" alt="모바일 반응형 뷰" width="300" />
</div>
</details>

## 30초 이해 체크리스트

이 도구를 열면 30초 안에 다음을 파악할 수 있습니다:

| # | 질문 | 어디서 확인? |
|---|------|-------------|
| 1 | 에이전트가 몇 개 돌았나? | Summary strip + 레인 헤더 |
| 2 | 지금 누가 running/waiting/done인가? | 상태 점, 노드 형태, Inspector |
| 3 | 마지막 handoff는 어디서 어디로? | Anomaly jump bar |
| 4 | 가장 긴 공백은 어디? | Gap chip + Summary 메타데이터 |
| 5 | 실패했다면 첫 실패 지점은? | "First error" 점프 버튼 |
| 6 | 최종 산출물은 누가 만들었나? | Artifact chip + Inspector |

## 아키텍처

```
┌────────────────────────────────────────────────────┐
│                   Tauri 2 Shell                    │
│  ┌──────────────────────────────────────────────┐  │
│  │              React 19 Frontend               │  │
│  │                                              │  │
│  │  ┌─────────┐  ┌───────────┐  ┌───────────┐  │  │
│  │  │Run List │  │  Causal   │  │ Inspector │  │  │
│  │  │  Rail   │  │  Graph    │  │   Panel   │  │  │
│  │  │ (280px) │  │  Canvas   │  │  (360px)  │  │  │
│  │  └─────────┘  └───────────┘  └───────────┘  │  │
│  │                                              │  │
│  │  ┌──────────────────────────────────────────┐│  │
│  │  │     Bottom Drawer (Artifacts/Import)     ││  │
│  │  └──────────────────────────────────────────┘│  │
│  └──────────────────────────────────────────────┘  │
│                     IPC Bridge                     │
│  ┌──────────────────────────────────────────────┐  │
│  │              Rust Backend                    │  │
│  │         serde · serde_json · tauri           │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

### 도메인 모델

```
Project → Session → Run → Agent Lane → Event
                            ↕ Edge (spawn / handoff / transfer / merge)
                            → Artifact
```

| 상태 | 설명 | 색상 |
|------|------|------|
| `running` | 실행 중 | 파란색 |
| `done` | 완료 | 초록색 |
| `waiting` | 대기 중 | 노란색 |
| `blocked` | 차단됨 | 주황색 |
| `failed` | 실패 | 빨간색 |
| `stale` | 비활성 (5초+ 무응답) | 분홍색 |
| `disconnected` | 연결 끊김 (20초+) | 회색 |

## 기술 스택

| 계층 | 기술 | 버전 |
|------|------|------|
| **데스크톱** | Tauri | 2 |
| **프론트엔드** | React | 19 |
| **번들러** | Vite | 7 |
| **언어** | TypeScript (strict) | 5.8 |
| **백엔드** | Rust | stable |
| **아이콘** | lucide-react | 0.577 |
| **린터** | Biome | 2.4 |
| **단위 테스트** | Vitest | 4 |
| **E2E 테스트** | Playwright | 1.58 |
| **컴포넌트 문서** | Storybook | 10 |

## 시작하기

### 사전 요구사항

- [Node.js](https://nodejs.org/) >= 20.19
- [pnpm](https://pnpm.io/) 10+
- [Rust](https://www.rust-lang.org/tools/install) stable
- Tauri 2 [시스템 의존성](https://v2.tauri.app/start/prerequisites/)

### 설치

```bash
git clone https://github.com/choegihwan/codex-multi-agent-monitor.git
cd codex-multi-agent-monitor
pnpm install
```

### 실행

```bash
# 웹 개발 서버 (Vite)
pnpm dev

# Tauri 데스크톱 앱 (Rust + React)
pnpm tauri:dev

# 프로덕션 빌드
pnpm tauri:build
```

## 개발 명령어

```bash
pnpm lint            # Biome 린트
pnpm typecheck       # TypeScript 타입 체크
pnpm test            # Vitest 단위 테스트
pnpm test:e2e        # Playwright E2E 테스트
pnpm storybook:build # Storybook 빌드
pnpm build           # 프로덕션 빌드
```

## 키보드 단축키

| 키 | 동작 |
|----|------|
| `/` | 검색 포커스 |
| `I` | Inspector 토글 |
| `.` | Follow live 토글 |
| `E` | Error-only 필터 |
| `W` | Waterfall 모드 |
| `M` | Map 모드 |
| `Tab` | 패널 이동 |
| `Arrow` | 목록/행 이동 |
| `Esc` | 드로어/메뉴 닫기 |

## CI/CD

- **PR 검증**: lint, typecheck, test, e2e, Rust check 자동 실행
- **릴리스**: `v*` 태그 push 시 macOS / Windows / Linux 크로스빌드 → GitHub Releases draft

```bash
# 릴리스 플로우
node scripts/bump-version.mjs 0.2.0
git add -A && git commit -m "chore: bump version to 0.2.0"
git tag v0.2.0
git push origin main --tags
# → GitHub Actions가 크로스빌드 후 draft release 생성
```

## 프로젝트 구조

```
src/
├── app/                    # 앱 쉘 & 상태 관리
├── features/
│   ├── run-list/           # 워크스페이스 런 트리 (SCR-001)
│   ├── run-detail/         # 그래프 캔버스 & 레이아웃 (SCR-002)
│   ├── inspector/          # 인스펙터 패널 (SCR-003)
│   ├── ingestion/          # 파서, 정규화기, 저장소
│   └── fixtures/           # 테스트 픽스처 (FIX-001~007)
├── shared/
│   ├── domain/             # 타입, 셀렉터, 포맷터
│   └── ui/                 # Panel, StatusChip, MetricPill 등
└── theme/                  # 디자인 토큰 (색상, 간격, 모션)

src-tauri/                  # Rust 백엔드
tests/                      # Vitest + Playwright 테스트
docs/                       # 문서 & 스크린샷
tasks/                      # 태스크 번들 (PRD, UX Spec, Tech Spec)
```

## 로드맵

- [x] 3-Pane 레이아웃 (Run List / Graph / Inspector)
- [x] 인과관계 그래프 렌더링 (spawn, handoff, transfer, merge)
- [x] Summary strip & Anomaly jump bar
- [x] 7가지 테스트 픽스처 (정상/대기/실패/병렬/마스킹/라이브/에러)
- [x] JSON import & Bottom drawer
- [x] 반응형 레이아웃 & 모바일 뷰
- [ ] Waterfall / Map 렌더러
- [ ] Live watch tail & reconnect
- [ ] 대규모 런 가상화 (virtualization)
- [ ] Export 기능

## 문서

상세한 사양서와 설계 문서는 `tasks/codex-multi-agent-monitor-v0-1/` 디렉토리에 있습니다:

| 문서 | 내용 |
|------|------|
| [PRD.md](tasks/codex-multi-agent-monitor-v0-1/PRD.md) | 제품 요구사항 정의 |
| [UX_SPEC.md](tasks/codex-multi-agent-monitor-v0-1/UX_SPEC.md) | UX 사양 (레이아웃, 토큰, 흐름) |
| [TECH_SPEC.md](tasks/codex-multi-agent-monitor-v0-1/TECH_SPEC.md) | 기술 사양 (도메인 모델, 파이프라인) |
| [ENGINEERING_RULES.md](docs/ai/ENGINEERING_RULES.md) | 스택, 아키텍처, 코딩 규칙 |

## 라이선스

MIT
