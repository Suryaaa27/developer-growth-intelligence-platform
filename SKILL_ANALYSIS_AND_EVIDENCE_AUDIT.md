# DevGrowth — Skill Analysis and Evidence Accuracy Audit Report

**Date:** November 9, 2026  
**Status:** Audit & Remediation Complete  
**Scope:** `SkillAnalysis.jsx`, `SkillGaps.jsx`, `useScrollReveal.js`, `skillMatcher.js`, `languageAnalyzer.js`, `skillDetectionService.js`, `skillController.js`

---

## 1. Root Cause of Missing Skill Cards / Tables on Skill Analysis

### Symptom
- **All Categories** tab displayed count: `19`
- **Framework** tab displayed count: `1`
- **Language** tab displayed count: `14` (now `13` after Docker category correction)
- **Tool** tab displayed count: `4` (now `5` after Docker category correction)
- Below the category tab bar, no skill listings were visible.

### Root Cause
1. **Initial Mount Timing & Zero Elements:**
   - In `client/src/pages/SkillAnalysis.jsx`, the skill table sections were rendered with `className="reveal-on-scroll"`:
     ```jsx
     <section key={group.id} className="reveal-on-scroll" aria-labelledby={`sec-${group.id}`}>
     ```
   - In `client/src/index.css` (line 2568), `.reveal-on-scroll` is styled with:
     ```css
     .reveal-on-scroll {
       opacity: 0;
       transform: translateY(8px);
       ...
     }
     ```
   - The scroll reveal hook (`useScrollReveal` in `AppLayout.jsx`) only queried the DOM once on initial layout mount: `useEffect(..., [containerRef])`.
   - On initial mount, `SkillAnalysis` was in its loading state (`loading = true`). At that point, `root.querySelectorAll('.reveal-on-scroll')` returned **0 elements**, causing the effect to exit immediately without attaching an `IntersectionObserver`.
2. **Missing Dynamic Mutation Observation:**
   - When the asynchronous API call (`GET /api/skills`) resolved and `filteredCategories` rendered `<section className="reveal-on-scroll">` into the DOM, `useScrollReveal` never re-executed.
   - Because `.is-revealed` was never added, the sections remained permanently locked at `opacity: 0`.
   - Switching category tabs also re-mounted fresh sections lacking `.is-revealed`, causing them to stay invisible.

### Fix
- **`client/src/hooks/useScrollReveal.js`**: Enhanced with a `MutationObserver` on the layout root so any dynamically inserted `.reveal-on-scroll` elements (from async data loading or tab switches) are immediately observed and revealed.
- **`client/src/pages/SkillAnalysis.jsx`**: Added `is-revealed` to `<section key={group.id} className="reveal-on-scroll is-revealed">` ensuring the table is rendered visible immediately upon data arrival, with smooth tab transitions handled by `.tab-content` (`tabFadeIn`).

---

## 2. Exact List of Detected Skills for User 417 (`tester1@gmail.com`)

Total Detected Skills: **19 Distinct Skills** across 16 synchronized repositories.

| # | Skill Name | Category | Primary Evidence Type | Confidence Score | Contributing Repositories |
|---|---|---|---|---|---|
| 1 | **JavaScript** | Language | `language_bytes` | 95% | 7 repos: `Suryaaa27/my-portfolio`, `susmitapatil11/MarraigeBureau`, `Suryaaa27/RoxilerAssesment`, `Suryaaa27/developer-growth-intelligence-platform`, `VishwajitS7/404-Regi`, `krushh67/client-appointment-booking-system`, `Suryaaa27/Jenkins_CICD_WebApp` |
| 2 | **Java** | Language | `language_bytes` | 95% | 1 repo: `Suryaaa27/lab1` (116 bytes, 100% of repo source) |
| 3 | **HTML** | Language | `language_bytes` | 95% | 9 repos: `Suryaaa27/repo`, `Suryaaa27/Jenkins_CICD_WebApp`, `VishwajitS7/404-Regi`, `OystersKode/ConferenceApp`, `Suryaaa27/developer-growth-intelligence-platform`, `Suryaaa27/my-portfolio`, `Suryaaa27/RoxilerAssesment`, `krushh67/client-appointment-booking-system`, `susmitapatil11/MarraigeBureau` |
| 4 | **Python** | Language | `language_bytes` | 95% | 2 repos: `krushh67/Disease_Prediction`, `krushh67/client-appointment-booking-system` |
| 5 | **Dart** | Language | `language_bytes` | 88% | 1 repo: `OystersKode/ConferenceApp` (387,648 bytes, 88.3% of repo source) |
| 6 | **Docker** | Tool | `config_file` | 85% | 1 repo: `krushh67/client-appointment-booking-system` (Dockerfile & docker-compose.yml) |
| 7 | **Jenkins (CI/CD)** | Tool | `config_file` | 80% | 2 repos: `Suryaaa27/Jenkins_CICD_WebApp`, `krushh67/client-appointment-booking-system` (Jenkinsfile present) |
| 8 | **Docker Compose** | Tool | `config_file` | 75% | 1 repo: `krushh67/client-appointment-booking-system` (docker-compose.yml) |
| 9 | **React Testing Library** | Tool | `dependency` | 70% | 1 repo: `VishwajitS7/404-Regi` (`@testing-library/react@^16.3.1` in `package.json`) |
| 10 | **React** | Framework | `dependency` | 70% | 3 repos: `VishwajitS7/404-Regi`, `Suryaaa27/my-portfolio`, `susmitapatil11/MarraigeBureau` (`react` in `package.json`) |
| 11 | **CSS** | Language | `language_bytes` | 55% | 7 repos: `Suryaaa27/Jenkins_CICD_WebApp`, `VishwajitS7/404-Regi`, `Suryaaa27/developer-growth-intelligence-platform`, `Suryaaa27/my-portfolio`, `Suryaaa27/RoxilerAssesment`, `krushh67/client-appointment-booking-system`, `susmitapatil11/MarraigeBureau` |
| 12 | **Vite** | Tool | `dependency` | 50% | 2 repos: `Suryaaa27/my-portfolio`, `susmitapatil11/MarraigeBureau` (`vite` in `package.json`) |
| 13 | **C++** | Language | `language_bytes` | 10% | 1 repo: `OystersKode/ConferenceApp` (26,378 bytes, 6.0% of repo source) |
| 14 | **CMake** | Language | `language_bytes` | 10% | 1 repo: `OystersKode/ConferenceApp` (19,899 bytes, 4.5% of repo source) |
| 15 | **Swift** | Language | `language_bytes` | 10% | 1 repo: `OystersKode/ConferenceApp` (2,627 bytes, 0.6% of repo source) |
| 16 | **C** | Language | `language_bytes` | 10% | 1 repo: `OystersKode/ConferenceApp` (1,488 bytes, 0.3% of repo source) |
| 17 | **PowerShell** | Language | `language_bytes` | 10% | 1 repo: `krushh67/client-appointment-booking-system` (1,625 bytes, 1.0% of repo source) |
| 18 | **Kotlin** | Language | `language_bytes` | 10% | 1 repo: `OystersKode/ConferenceApp` (128 bytes, <0.1% of repo source) |
| 19 | **Objective-C** | Language | `language_bytes` | 10% | 1 repo: `OystersKode/ConferenceApp` (38 bytes, <0.1% of repo source) |

**Category Distribution:**
- **Framework (1):** React
- **Language (13):** JavaScript, Java, HTML, Python, Dart, CSS, C++, CMake, Swift, C, PowerShell, Kotlin, Objective-C
- **Tool (5):** Docker, Jenkins (CI/CD), Docker Compose, React Testing Library, Vite

---

## 3. Repository-by-Repository Evidence Audit

The database holds 16 synchronized repositories for user 417 (`Suryaaa27`):

### A. Owned Repositories (11)
1. `Suryaaa27/developer-growth-intelligence-platform`
   - Owner: `Suryaaa27` | Fork: `false` | HTML: `https://github.com/Suryaaa27/developer-growth-intelligence-platform`
   - Verified Evidence: JavaScript (92.2%), CSS (7.6%), HTML (0.1%)
2. `Suryaaa27/my-portfolio`
   - Owner: `Suryaaa27` | Fork: `false` | HTML: `https://github.com/Suryaaa27/my-portfolio`
   - Verified Evidence: JavaScript (94.9%), CSS (4.4%), HTML (0.7%), React (v19.2.4 in `package.json`), Vite (v8.0.1 in `package.json`)
   - **Java Check:** Zero `.java` files, zero Java language bytes, zero Maven/Gradle manifests.
3. `Suryaaa27/gitflow`
   - Owner: `Suryaaa27` | Fork: `false` | Empty repository, no detectable languages or manifests.
4. `Suryaaa27/Jenkins_CICD_WebApp`
   - Owner: `Suryaaa27` | Fork: `false` | HTML: `https://github.com/Suryaaa27/Jenkins_CICD_WebApp`
   - Verified Evidence: CSS (54.8%), HTML (39.3%), JavaScript (5.9%), Jenkinsfile (`Jenkins (CI/CD)`)
5. `Suryaaa27/WebApp_Demo`
   - Owner: `Suryaaa27` | Fork: `false` | No language bytes recorded.
6. `Suryaaa27/RoxilerAssesment`
   - Owner: `Suryaaa27` | Fork: `false` | HTML: `https://github.com/Suryaaa27/RoxilerAssesment`
   - Verified Evidence: JavaScript (93.3%), CSS (6.2%), HTML (0.6%)
7. `Suryaaa27/lab1`
   - Owner: `Suryaaa27` | Fork: `true` | HTML: `https://github.com/Suryaaa27/lab1`
   - Verified Evidence: **Java (116 bytes, 100.0% of source)**. Single standalone Java source file.
8. `Suryaaa27/DevOps_Lab`
   - Owner: `Suryaaa27` | Fork: `false` | No language bytes recorded.
9. `Suryaaa27/club-reg`
   - Owner: `Suryaaa27` | Fork: `false` | No language bytes recorded.
10. `Suryaaa27/AK`
    - Owner: `Suryaaa27` | Fork: `false` | No language bytes recorded.
11. `Suryaaa27/repo`
    - Owner: `Suryaaa27` | Fork: `false` | HTML: `https://github.com/Suryaaa27/repo`
    - Verified Evidence: HTML (219 bytes, 100.0% of source)

### B. Collaboration Repositories (5)
12. `krushh67/client-appointment-booking-system`
    - Owner: `krushh67` | Fork: `false`
    - Verified Evidence: JavaScript (76.5%), Python (19.0%), PowerShell (1.0%), HTML (0.5%), CSS (0.3%), `Dockerfile` (Docker), `docker-compose.yml` (Docker Compose), `Jenkinsfile` (Jenkins CI/CD), `requirements.txt` (Python)
13. `krushh67/Disease_Prediction`
    - Owner: `krushh67` | Fork: `false`
    - Verified Evidence: Python (5,439 bytes, 100.0% of source)
14. `susmitapatil11/MarraigeBureau`
    - Owner: `susmitapatil11` | Fork: `false`
    - Verified Evidence: JavaScript (95.6%), CSS (4.0%), HTML (0.4%), React (v19.1.1 in `package.json`), Vite (v7.1.3 in `package.json`)
    - **Java Check:** Zero `.java` files, zero Java language bytes, zero Maven/Gradle manifests.
15. `OystersKode/ConferenceApp`
    - Owner: `OystersKode` | Fork: `false`
    - Verified Evidence: Dart (88.3%), C++ (6.0%), CMake (4.5%), Swift (0.6%), HTML (0.2%), C (0.3%), Kotlin (<0.1%), Objective-C (<0.1%)
16. `VishwajitS7/404-Regi`
    - Owner: `VishwajitS7` | Fork: `false`
    - Verified Evidence: JavaScript (75.7%), CSS (20.8%), HTML (3.5%), React (v19.2.3 in `package.json`), `@testing-library/react` (v16.3.1 in `package.json`)

---

## 4. Java & Docker Verification Results

### Java Verification
- **Observed Bug:** Skill Gaps previously reported:
  - Java: 95% Strength, Evidence Found, 7 repositories (citing `Suryaaa27/my-portfolio` and `susmitapatil11/MarraigeBureau`).
- **Investigation:**
  - Neither `my-portfolio` nor `MarraigeBureau` contains Java. They are pure React / JavaScript / Vite web apps.
  - In `client/src/pages/SkillGaps.jsx` line 50 and `server/src/utils/skillMatcher.js` line 72, the substring matcher evaluated:
    ```javascript
    dNorm.includes(rNorm) // 'javascript'.includes('java') === true
    ```
  - When matching the required role skill `"Java"`, the comparator matched `"JavaScript"`.
  - Because `JavaScript` had 7 contributing repositories, `Java` inherited JavaScript's 7 repositories and 95% confidence score.
- **Correction:**
  - Added strict disambiguation guards to `isSkillMatch` and `isSkillMatchClient`:
    ```javascript
    if (rNorm === 'java' && (dNorm === 'javascript' || dNorm.includes('javascript'))) return false;
    if (dNorm === 'java' && (rNorm === 'javascript' || rNorm.includes('javascript'))) return false;
    ```
  - Also guarded `comp.matchKey === 'java'`.
- **Result:**
  - Java now exclusively matches genuine Java evidence: **1 repository (`Suryaaa27/lab1`)**, 95% confidence (100% Java source).
  - React repositories (`my-portfolio`, `MarraigeBureau`) are no longer falsely attributed to Java.

### Docker Verification
- **Observed Behavior:** Docker was reported with `85% Strength`, `1 repository` (`krushh67/client-appointment-booking-system`), `Detection method: language bytes`.
- **Investigation:**
  - `krushh67/client-appointment-booking-system` genuinely contains a real `Dockerfile` (4,737 bytes) and `docker-compose.yml`.
  - GitHub's Linguist API classifies `Dockerfile` under its repository languages endpoint (`"Dockerfile": 4737`).
  - `server/src/analyzers/languageAnalyzer.js` had `Dockerfile: 'Docker'` in `LANGUAGE_SKILL_MAP`, tagging it as `evidenceType: 'language_bytes'`.
  - Both `skillDetectionService.js` and `skillController.js` had priority order `['language_bytes', 'dependency', 'config_file']`, picking `language_bytes` over `config_file`.
  - `resolveSkillCategory` checked `if (evidenceType === 'language_bytes') return 'Language'`, causing Docker to be classified as a `Language` instead of a `Tool`.
- **Correction:**
  - Removed `Dockerfile: 'Docker'` from `languageAnalyzer.js`. Docker is container infrastructure, not a programming language.
  - In `skillDetectionService.js` and `skillController.js`, inverted priority to `['dependency', 'config_file', 'language_bytes']`, ensuring structural artifacts take precedence over raw language byte counts.
  - In `resolveSkillCategory`, prioritized `FILE_EVIDENCE_MAP` lookups so Docker maps directly to `category: 'Tool'`.
  - In `skillController.js`, normalized legacy rows where Docker from Dockerfile was tagged as `language_bytes` to `config_file`.
- **Result:**
  - Docker is now accurately reported as:
    - **Category:** `Tool`
    - **Evidence Type:** `config_file`
    - **Details:** `Detected Dockerfile at path "Dockerfile" in repository.`

---

## 5. Spring Boot, MySQL, GitHub Actions & JUnit Verification

| Competency | Synchronized Evidence Check | Status | Verification Detail |
|---|---|---|---|
| **Spring Boot** | 0 `pom.xml`, 0 `build.gradle`, 0 `application.properties` with Spring dependencies across all 16 repos | **Missing Signal (Correct)** | Genuinely absent from user's codebases. |
| **MySQL** | 0 `mysql`, `mysql2`, `typeorm`, or `sequelize` dependencies in any `package.json` | **Missing Signal (Correct)** | Genuinely absent from user's codebases. |
| **GitHub Actions** | 0 `.github/workflows/` files in any of the 16 repos (Jenkinsfile is used instead) | **Missing Signal (Correct)** | Genuinely absent (Jenkins CI/CD is present in 2 repos, but no GitHub Actions workflows exist). |
| **JUnit** | 0 `pom.xml` test-scope dependencies across all 16 repos | **Missing Signal (Correct)** | Genuinely absent from user's codebases. |

**Conclusion:** All four competencies are genuinely missing. The "Missing Signal" designation on the Skill Gaps page is **100% technically accurate** and properly prompts the user with admin-curated learning templates.

---

## 6. Discovered False Positives

1. **`Java` matching `JavaScript`:**
   - **Type:** Substring false positive in matcher logic.
   - **Impact:** Any user with JavaScript was marked as having Java across all JavaScript repositories.
   - **Status:** **Fixed** in both frontend and backend matchers.
2. **`Docker` classified as `Language` via `language_bytes`:**
   - **Type:** Classification and analyzer priority inversion.
   - **Impact:** Real Dockerfile was mislabeled as a programming language byte count rather than a container config file.
   - **Status:** **Fixed** by removing Dockerfile from `languageAnalyzer.js`, updating priority order, and mapping to `Tool`.

---

## 7. Files Modified

1. **[`client/src/hooks/useScrollReveal.js`](file:///d:/Projects/developer-growth-platform/client/src/hooks/useScrollReveal.js)**:
   - Added `MutationObserver` to automatically observe dynamically loaded and updated DOM elements with `.reveal-on-scroll`.
2. **[`client/src/pages/SkillAnalysis.jsx`](file:///d:/Projects/developer-growth-platform/client/src/pages/SkillAnalysis.jsx)**:
   - Added `is-revealed` to `<section key={group.id} className="reveal-on-scroll is-revealed">` ensuring skill tables display immediately upon API response.
3. **[`client/src/pages/SkillGaps.jsx`](file:///d:/Projects/developer-growth-platform/client/src/pages/SkillGaps.jsx)**:
   - Added Java/JavaScript disambiguation guard to `isSkillMatchClient`, `missingSkillNames`, and `competencyComparisons`.
4. **[`server/src/utils/skillMatcher.js`](file:///d:/Projects/developer-growth-platform/server/src/utils/skillMatcher.js)**:
   - Added strict Java/JavaScript disambiguation guard in `isSkillMatch` and compound alternatives.
5. **[`server/src/analyzers/languageAnalyzer.js`](file:///d:/Projects/developer-growth-platform/server/src/analyzers/languageAnalyzer.js)**:
   - Removed `Dockerfile: 'Docker'` so Docker is detected strictly from containerization artifacts via `fileEvidenceAnalyzer`.
6. **[`server/src/services/skillDetectionService.js`](file:///d:/Projects/developer-growth-platform/server/src/services/skillDetectionService.js)**:
   - Inverted analyzer merge priority to `['dependency', 'config_file', 'language_bytes']`.
7. **[`server/src/controllers/skillController.js`](file:///d:/Projects/developer-growth-platform/server/src/controllers/skillController.js)**:
   - Updated `pickPrimaryEvidenceType` priority to `['dependency', 'config_file', 'language_bytes']`.
   - Updated `resolveSkillCategory` to prioritize `FILE_EVIDENCE_MAP` (`Tool`) before language byte fallback.
   - Normalized legacy Docker rows with Dockerfile to `config_file`.
8. **[`server/scripts/testSkillAnalysisAndEvidenceAudit.js`](file:///d:/Projects/developer-growth-platform/server/scripts/testSkillAnalysisAndEvidenceAudit.js)** & **`server/package.json`**:
   - Added focused 21-test automated suite verifying skill matching, database evidence isolation, Docker attribution, and category counts.

---

## 8. Test Execution & Verification Results

### A. Backend Test Suites
- **`npm --prefix server run test:audit`**:
  - `[1/5] Skill Matcher Disambiguation`: 7 passed
  - `[2/5] Category Resolution & Docker Attribution`: 6 passed
  - `[3/5] Database Evidence Audit (User 417)`: 5 passed
  - `[4/5] Aggregated Skills (19 Skills)`: 1 passed
  - `[5/5] Confidence Calculations`: 2 passed
  - **Result: 21 Passed, 0 Failed**
- **`npm --prefix server run test:roles`**:
  - **Result: 67 Passed, 0 Failed**
- **`npm --prefix server run test:skills`**:
  - **Result: 100 Passed, 0 Failed**
- **`npm --prefix server run test:persistence`**:
  - **Result: 90 Passed, 0 Failed**
- **`npm --prefix server run test:ownership`**:
  - **Result: 33 Passed, 0 Failed**

### B. Frontend Verification
- **`npm --prefix client run lint`**:
  - **Result: 0 errors**, 19 pre-existing warnings in unrelated files (42ms)
- **`npm --prefix client run build`**:
  - **Result: Built successfully** in 173ms (`dist/` generated cleanly)

---
*End of Audit Report.*

