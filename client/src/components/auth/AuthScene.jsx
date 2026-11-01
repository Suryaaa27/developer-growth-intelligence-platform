import React, { useEffect, useRef } from 'react';
import useReducedMotion from './useReducedMotion';
import './auth-scene.css';

/* ── Commit messages and skill detection labels ──────────────────────────── */
const COMMIT_MESSAGES = [
  'feat: add login',
  'fix: null check',
  'refactor: service layer',
  'docs: update readme',
  'test: add unit tests',
  'chore: bump deps',
];

const SKILL_DETECTIONS = [
  'Java detected',
  'React detected',
  'SQL detected',
  'Spring Boot detected',
  'Docker detected',
  'Node.js detected',
];

/**
 * Full-screen Git Graph ("Branch Lines") Background
 * Flat, minimal orthogonal branches with commit nodes, rounded corners,
 * and small mono labels. Zero gradients, zero glow, zero blur.
 */
const AuthScene = ({ headline, subline }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();

  const stateRef = useRef({
    width: 0,
    height: 0,
    dpr: 1,
    isDark: true,
    colors: {
      bg: '#0d1117',
      main: '#3fb950',
      sec: '#388bfd',
      accent: '#d29922',
      neutral: '#30363d',
      chipBg: '#161b22',
      chipBorder: '#30363d',
      chipText: '#c9d1d9',
      muted: '#8b949e',
      danger: '#f85149',
    },
    branches: [],
    branchCounter: 0,
    lastSpawn: 0,
    spawnInterval: 2000,
    pointer: { x: -1000, y: -1000, lastMoved: 0 },
    hasAccentTarget: false,
    isCalm: false,
    isError: false,
    isSuccess: false,
    isVisible: true,
    isTabActive: true,
  });

  // 1. Read flat theme colors at start & on theme change
  useEffect(() => {
    const updateColors = () => {
      const isDark =
        document.documentElement.getAttribute('data-theme') === 'dark' ||
        (!document.documentElement.getAttribute('data-theme') &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);

      stateRef.current.isDark = isDark;
      stateRef.current.colors = isDark
        ? {
            bg: '#0d1117',
            main: '#3fb950',
            sec: '#388bfd',
            accent: '#d29922',
            neutral: '#30363d',
            chipBg: '#161b22',
            chipBorder: '#30363d',
            chipText: '#c9d1d9',
            muted: '#8b949e',
            danger: '#f85149',
          }
        : {
            bg: '#f6f8fa',
            main: '#1a7f37',
            sec: '#0969da',
            accent: '#bf8700',
            neutral: '#d0d7de',
            chipBg: '#ffffff',
            chipBorder: '#d0d7de',
            chipText: '#24292f',
            muted: '#57606a',
            danger: '#cf222e',
          };
    };

    updateColors();

    const themeObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'data-theme') {
          updateColors();
          break;
        }
      }
    });

    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const colorSchemeMql = window.matchMedia('(prefers-color-scheme: dark)');
    const handleColorScheme = () => updateColors();
    colorSchemeMql.addEventListener('change', handleColorScheme);

    return () => {
      themeObserver.disconnect();
      colorSchemeMql.removeEventListener('change', handleColorScheme);
    };
  }, []);

  // 2. Password focus & DOM Flash messages observation
  useEffect(() => {
    const pageWrapper = document.querySelector('.auth-page');

    const handleFocusIn = (e) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement &&
        (target.type === 'password' || (target.id && target.id.toLowerCase().includes('password')))
      ) {
        stateRef.current.isCalm = true;
        if (pageWrapper) pageWrapper.classList.add('auth-page--calm');
      }
    };

    const handleFocusOut = (e) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement &&
        (target.type === 'password' || (target.id && target.id.toLowerCase().includes('password')))
      ) {
        stateRef.current.isCalm = false;
        if (pageWrapper) pageWrapper.classList.remove('auth-page--calm');
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    const checkFlashes = () => {
      const hasError = !!document.querySelector('.auth-flash--error, .flash--error, [class*="flash--error"]');
      const hasSuccess = !!document.querySelector('.auth-flash--success, .flash--success, [class*="flash--success"]');

      if (hasError) {
        stateRef.current.isError = true;
        if (pageWrapper) {
          pageWrapper.classList.add('auth-page--error');
          setTimeout(() => pageWrapper.classList.remove('auth-page--error'), 600);
        }
        setTimeout(() => {
          stateRef.current.isError = false;
        }, 1200);
      }

      if (hasSuccess) {
        stateRef.current.isSuccess = true;
        setTimeout(() => {
          stateRef.current.isSuccess = false;
        }, 1500);
      }
    };

    const flashObserver = new MutationObserver(checkFlashes);
    flashObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      flashObserver.disconnect();
    };
  }, []);

  // 3. Pointer tracking for bias turns & node hover
  useEffect(() => {
    const handlePointerMove = (e) => {
      stateRef.current.pointer.x = e.clientX;
      stateRef.current.pointer.y = e.clientY;
      stateRef.current.pointer.lastMoved = Date.now();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  // 4. Main Canvas Git-Graph Simulation Loop
  useEffect(() => {
    if (prefersReducedMotion) {
      // Draw static composition with 3 clean orthogonal branches
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const w = (canvas.width = window.innerWidth);
        const h = (canvas.height = window.innerHeight);
        const isDark = stateRef.current.isDark;
        const main = isDark ? '#3fb950' : '#1a7f37';
        const sec = isDark ? '#388bfd' : '#0969da';
        const bg = isDark ? '#0d1117' : '#f6f8fa';

        ctx.strokeStyle = main;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w * 0.1, h * 0.2);
        ctx.lineTo(w * 0.35, h * 0.2);
        ctx.arcTo(w * 0.45, h * 0.2, w * 0.45, h * 0.45, 14);
        ctx.lineTo(w * 0.45, h * 0.6);
        ctx.stroke();

        ctx.strokeStyle = sec;
        ctx.beginPath();
        ctx.moveTo(w * 0.9, h * 0.7);
        ctx.lineTo(w * 0.6, h * 0.7);
        ctx.arcTo(w * 0.55, h * 0.7, w * 0.55, h * 0.5, 14);
        ctx.lineTo(w * 0.55, h * 0.35);
        ctx.stroke();

        // 3 sample nodes
        [{ x: w * 0.22, y: h * 0.2, c: main }, { x: w * 0.45, y: h * 0.45, c: main }, { x: w * 0.75, y: h * 0.7, c: sec }].forEach(
          (nd) => {
            ctx.beginPath();
            ctx.arc(nd.x, nd.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = bg;
            ctx.fill();
            ctx.strokeStyle = nd.c;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        );
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const handleResize = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      stateRef.current.width = w;
      stateRef.current.height = h;
      stateRef.current.dpr = dpr;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const handleVisibilityChange = () => {
      stateRef.current.isTabActive = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ── Spawner function ─────────────────────────────────────────────────────
    const spawnBranch = (now, w, h) => {
      const isMobile = w <= 768;
      const maxBranches = isMobile ? 3 : 6;
      if (stateRef.current.branches.length >= maxBranches) return;

      stateRef.current.branchCounter += 1;
      const count = stateRef.current.branchCounter;
      const isMain = count % 2 !== 0; // Alternating main vs secondary
      const isBg = Math.random() < 0.4; // 40% background layer

      // Spawn outside a random edge (0: Top, 1: Right, 2: Bottom, 3: Left)
      const edge = Math.floor(Math.random() * 4);
      let x = 0;
      let y = 0;
      let dir = { dx: 0, dy: 0 }; // Initial orthogonal unit vector

      if (edge === 0) {
        x = w * 0.15 + Math.random() * (w * 0.7);
        y = -10;
        dir = { dx: 0, dy: 1 };
      } else if (edge === 1) {
        x = w + 10;
        y = h * 0.15 + Math.random() * (h * 0.7);
        dir = { dx: -1, dy: 0 };
      } else if (edge === 2) {
        x = w * 0.15 + Math.random() * (w * 0.7);
        y = h + 10;
        dir = { dx: 0, dy: -1 };
      } else {
        x = -10;
        y = h * 0.15 + Math.random() * (h * 0.7);
        dir = { dx: 1, dy: 0 };
      }

      const speed = isBg ? 80 + Math.random() * 20 : 110 + Math.random() * 30; // 90-140 px/s

      stateRef.current.branches.push({
        id: count,
        birth: now,
        isMain,
        isBg,
        speed,
        points: [{ x, y }],
        head: { x, y },
        dir,
        distSinceLastTurn: 0,
        distToNextTurn: 120 + Math.random() * 140, // 120-260px
        distSinceLastNode: 0,
        distToNextNode: 90 + Math.random() * 70, // 90-160px
        nodes: [],
        stopped: false,
        stopReason: null, // 'merged' | 'edge'
        stopTime: 0,
        labelCounter: 0,
      });

      stateRef.current.lastSpawn = now;
      stateRef.current.spawnInterval = 1600 + Math.random() * 1000;
    };

    let lastTime = Date.now();
    let rAFId = null;

    // ── Render Frame ─────────────────────────────────────────────────────────
    const render = () => {
      const st = stateRef.current;
      const now = Date.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (st.isTabActive) {
        const { width: w, height: h, dpr, colors } = st;

        // 1. Spawning
        if (now - st.lastSpawn > st.spawnInterval) {
          spawnBranch(now, w, h);
        }

        // 2. Clear canvas with DPR scaling
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);

        const pointerMovedRecently = now - st.pointer.lastMoved < 2000;
        const speedScale = st.isCalm ? 0.4 : st.isError ? 0.0 : 1.0;

        // 3. Update branches
        for (let bIdx = st.branches.length - 1; bIdx >= 0; bIdx--) {
          const b = st.branches[bIdx];
          const age = (now - b.birth) / 1000;

          // Check life / retracting
          if (age > 14 && !b.stopped) {
            b.stopped = true;
            b.stopReason = 'aged';
            b.stopTime = now;
          }

          if (!b.stopped) {
            const step = b.speed * speedScale * dt;
            b.head.x += b.dir.dx * step;
            b.head.y += b.dir.dy * step;
            b.distSinceLastTurn += step;
            b.distSinceLastNode += step;

            // Check if ready to spawn commit node (every 90-160px)
            if (b.distSinceLastNode >= b.distToNextNode) {
              b.distSinceLastNode = 0;
              b.distToNextNode = 90 + Math.random() * 70;
              b.labelCounter += 1;

              let label = null;
              let isAccent = false;

              // Every 2nd node gets a label chip
              if (b.labelCounter % 2 === 0) {
                // Rare accent "target role" marker
                if (!st.hasAccentTarget && Math.random() < 0.2) {
                  label = 'Target: Java Backend Developer';
                  isAccent = true;
                  st.hasAccentTarget = true;
                } else if (Math.random() < 0.5) {
                  label = SKILL_DETECTIONS[Math.floor(Math.random() * SKILL_DETECTIONS.length)];
                } else {
                  label = COMMIT_MESSAGES[Math.floor(Math.random() * COMMIT_MESSAGES.length)];
                }
              }

              b.nodes.push({
                x: b.head.x,
                y: b.head.y,
                birth: now,
                side: b.labelCounter % 4 === 0 ? 1 : -1,
                label,
                isAccent,
              });
            }

            // Check if ready to turn 90 degrees
            if (b.distSinceLastTurn >= b.distToNextTurn) {
              b.distSinceLastTurn = 0;
              b.distToNextTurn = 120 + Math.random() * 140;

              // Commit corner point
              b.points.push({ x: b.head.x, y: b.head.y });

              // Choose orthogonal turn (-90 or +90)
              let turnDir = Math.random() < 0.5 ? 1 : -1;

              // Biased toward cursor if cursor moved in last 2s (60% bias)
              if (pointerMovedRecently && Math.random() < 0.6) {
                const cx = st.pointer.x;
                const cy = st.pointer.y;
                if (b.dir.dx !== 0) {
                  // Currently moving horizontal -> turn vertical
                  turnDir = cy > b.head.y ? 1 : -1;
                } else {
                  // Currently moving vertical -> turn horizontal
                  turnDir = cx > b.head.x ? 1 : -1;
                }
              }

              if (b.dir.dx !== 0) {
                b.dir = { dx: 0, dy: turnDir };
              } else {
                b.dir = { dx: turnDir, dy: 0 };
              }
            }

            // Check merge: within 60px of another branch
            for (let oIdx = 0; oIdx < st.branches.length; oIdx++) {
              if (oIdx === bIdx) continue;
              const other = st.branches[oIdx];
              const dHead = Math.hypot(b.head.x - other.head.x, b.head.y - other.head.y);

              if (dHead < 60 && dHead > 5 && !other.stopped) {
                b.stopped = true;
                b.stopReason = 'merged';
                b.stopTime = now;
                b.points.push({ x: b.head.x, y: b.head.y });
                b.points.push({ x: other.head.x, y: other.head.y });
                b.nodes.push({
                  x: other.head.x,
                  y: other.head.y,
                  birth: now,
                  side: 1,
                  label: 'merged',
                  isAccent: false,
                });
                break;
              }
            }

            // Check if reached screen edge (+60px margin)
            if (
              b.head.x < -60 ||
              b.head.x > w + 60 ||
              b.head.y < -60 ||
              b.head.y > h + 60
            ) {
              b.stopped = true;
              b.stopReason = 'edge';
              b.stopTime = now;
            }
          }

          // Retract & prune old stopped branches (fade out over 1.5s)
          if (b.stopped && now - b.stopTime > 1500) {
            // Free accent target if this branch had it
            if (b.nodes.some((nd) => nd.isAccent)) {
              st.hasAccentTarget = false;
            }
            st.branches.splice(bIdx, 1);
            continue;
          }
        }

        // 4. Draw branches in two layers (background then foreground)
        [true, false].forEach((isBgLayer) => {
          for (let b of st.branches) {
            if (b.isBg !== isBgLayer) continue;

            ctx.save();

            // Opacity & Layering
            let branchAlpha = b.isBg ? 0.45 : 1.0;
            if (st.isCalm) branchAlpha *= 0.35;
            if (b.stopped && b.stopTime > 0) {
              const fadeRatio = 1 - (now - b.stopTime) / 1500;
              branchAlpha *= Math.max(0, fadeRatio);
            }

            ctx.globalAlpha = branchAlpha;

            // Stroke color (main vs secondary, or danger during error flash)
            let lineColor = b.isMain ? colors.main : colors.sec;
            if (st.isError) lineColor = colors.danger;

            ctx.strokeStyle = lineColor;
            ctx.lineWidth = b.isBg ? 1.5 : 2.0;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // ── Draw rounded orthogonal path ──
            const allPts = [...b.points, b.head];
            if (allPts.length >= 2) {
              ctx.beginPath();
              ctx.moveTo(allPts[0].x, allPts[0].y);

              const cornerRadius = 14;
              for (let i = 1; i < allPts.length - 1; i++) {
                const pCurr = allPts[i];
                const pNext = allPts[i + 1];
                ctx.arcTo(pCurr.x, pCurr.y, pNext.x, pNext.y, cornerRadius);
              }

              ctx.lineTo(allPts[allPts.length - 1].x, allPts[allPts.length - 1].y);
              ctx.stroke();
            }

            // ── Draw Error "x" & "revert" tag on active heads ──
            if (st.isError && !b.stopped) {
              ctx.strokeStyle = colors.danger;
              ctx.lineWidth = 2;
              const hx = b.head.x;
              const hy = b.head.y;
              ctx.beginPath();
              ctx.moveTo(hx - 5, hy - 5);
              ctx.lineTo(hx + 5, hy + 5);
              ctx.moveTo(hx + 5, hy - 5);
              ctx.lineTo(hx - 5, hy + 5);
              ctx.stroke();

              // "revert" chip
              ctx.font = '500 11px ui-monospace, SFMono-Regular, monospace';
              ctx.fillStyle = colors.danger;
              ctx.fillText('revert', hx + 10, hy + 4);
            }

            // ── Draw commit nodes & chips ──
            for (let nd of b.nodes) {
              const nodeAge = now - nd.birth;
              const popProgress = Math.min(1, nodeAge / 200);
              // Ease out back pop
              const c1 = 1.7;
              const c3 = c1 + 1;
              const popScale = 1 + c3 * Math.pow(popProgress - 1, 3) + c1 * Math.pow(popProgress - 1, 2);

              // Cursor hover scale (36px radius)
              const dCursor = Math.hypot(st.pointer.x - nd.x, st.pointer.y - nd.y);
              const isHovered = dCursor < 36;
              const hoverScale = isHovered ? 1.25 : 1.0;

              const rNode = 5 * Math.max(0, popScale) * hoverScale;

              let nodeColor = nd.isAccent ? colors.accent : lineColor;

              // Hollow commit node
              ctx.beginPath();
              ctx.arc(nd.x, nd.y, rNode, 0, Math.PI * 2);
              ctx.fillStyle = colors.bg;
              ctx.fill();
              ctx.strokeStyle = nodeColor;
              ctx.lineWidth = 2;
              ctx.stroke();

              // Draw chip label (if present or if hovered)
              if (nd.label || isHovered) {
                const labelText = nd.label || 'commit';
                ctx.font = '500 11px ui-monospace, SFMono-Regular, Consolas, monospace';
                const textW = ctx.measureText(labelText).width;
                const padX = 8;
                const pillW = textW + padX * 2 + (nd.isAccent ? 14 : 0);
                const pillH = 22;

                const offsetX = nd.side * (pillW / 2 + 14);
                const chipX = nd.x + offsetX;
                const chipY = nd.y;

                // Pill background
                ctx.beginPath();
                ctx.roundRect(chipX - pillW / 2, chipY - pillH / 2, pillW, pillH, 4);
                ctx.fillStyle = colors.chipBg;
                ctx.fill();
                ctx.strokeStyle = nd.isAccent ? colors.accent : colors.chipBorder;
                ctx.lineWidth = 1;
                ctx.stroke();

                // Flag icon for accent
                if (nd.isAccent) {
                  ctx.fillStyle = colors.accent;
                  ctx.beginPath();
                  ctx.moveTo(chipX - pillW / 2 + 6, chipY - 5);
                  ctx.lineTo(chipX - pillW / 2 + 12, chipY - 2);
                  ctx.lineTo(chipX - pillW / 2 + 6, chipY + 1);
                  ctx.fill();
                  ctx.fillRect(chipX - pillW / 2 + 5, chipY - 5, 1.5, 10);
                }

                // Text
                ctx.fillStyle = nd.isAccent ? colors.accent : colors.chipText;
                ctx.textBaseline = 'middle';
                const textDrawX = nd.isAccent ? chipX - pillW / 2 + 16 : chipX - textW / 2;
                ctx.fillText(labelText, textDrawX, chipY + 0.5);
              }
            }

            ctx.restore();
          }
        });

        ctx.restore();
      }

      rAFId = requestAnimationFrame(render);
    };

    rAFId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rAFId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [prefersReducedMotion]);

  return (
    <div ref={containerRef} className="auth-scene-container" aria-hidden="true">
      {/* Optional faint dotted grid only */}
      <div className="auth-scene-dots" />

      {/* Full-viewport canvas for branch lines */}
      <canvas ref={canvasRef} className="auth-scene-canvas" />
    </div>
  );
};

export default AuthScene;
