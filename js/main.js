import { createGameLoop } from "./gameLoop.js";
import {
  endFrameInput,
  initInput,
  isKeyDown,
  wasKeyPressed,
  getMousePos,
} from "./input.js";
import { getImage, preloadAssets } from "./assets.js";
import { clearCanvas, drawRect, drawSpriteFrame, drawText } from "./draw.js";
import { clamp, normalize } from "./math.js";
import { aabbIntersect } from "./collision.js";
import { registerScene, renderScene, setScene, updateScene, getCurrentSceneName } from "./sceneManager.js";
import { cooldown, updateTimers } from "./timer.js";
import { drawFPS, drawHitbox, isDebugEnabled, toggleDebug, updateDebug } from "./debug.js";
import { createAnimation, createAnimationSet } from "./animations.js";
import {
  ASSETS,
  DECOR_FRAMES,
  ENEMY_ANIMATIONS,
  ENVIRONMENT_ANIMATIONS,
  GOAL_SPRITE_FRAME,
  PLAYER_ANIMATIONS,
  TERRAIN_TILES,
  TILESET_KEY,
  TILE_RENDER,
} from "./gameAssets.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

if (!canvas || !ctx) {
  throw new Error("Canvas could not be initialized.");
}

initInput(canvas);

const player = {
  x: 120,
  y: 140,
  w: 16,
  h: 28,
  speed: 220,
  flipX: false,
};

const enemy = {
  x: 560,
  y: 220,
  w: 16,
  h: 16,
  speed: 100,
  dir: 1,
  flipX: true,
};

const goal = {
  x: 650,
  y: 260,
  w: 16,
  h: 16,
};

const state = {
  score: 0,
  loading: true,
  loadingProgress: 0,
  time: 0,
  tileset: null,
  playerAnimSet: null,
  enemyAnimSet: null,
  envAnims: null,
};

function pickTile(tiles, x, y) {
  return tiles[(x * 31 + y * 17) % tiles.length];
}

function randomizeGoal() {
  goal.x = 60 + Math.random() * (canvas.width - 120 - goal.w);
  goal.y = 60 + Math.random() * (canvas.height - 120 - goal.h);
}

function randomizeEnemyLane() {
  enemy.y = 120 + Math.random() * (canvas.height - 220);
}

function createCharacterAnimSet(definition, imageName, fps) {
  return createAnimationSet({
    idle: {
      imageName,
      frames: definition.idle,
      fps,
      loop: true,
      autoPlay: true,
    },
    run: {
      imageName,
      frames: definition.run,
      fps,
      loop: true,
      autoPlay: false,
    },
  });
}

function createEnvironmentAnimations(imageName) {
  return {
    spikes: createAnimation({
      imageName,
      image: getImage(imageName),
      frames: ENVIRONMENT_ANIMATIONS.spikes,
      fps: 8,
      loop: true,
      autoPlay: true,
    }),
    fountainTop: createAnimation({
      imageName,
      image: getImage(imageName),
      frames: ENVIRONMENT_ANIMATIONS.fountainTop,
      fps: 5,
      loop: true,
      autoPlay: true,
    }),
    fountainMid: createAnimation({
      imageName,
      image: getImage(imageName),
      frames: ENVIRONMENT_ANIMATIONS.fountainMid,
      fps: 5,
      loop: true,
      autoPlay: true,
    }),
    fountainBasin: createAnimation({
      imageName,
      image: getImage(imageName),
      frames: ENVIRONMENT_ANIMATIONS.fountainBasin,
      fps: 5,
      loop: true,
      autoPlay: true,
    }),
  };
}

function updateAnimations(dt) {
  if (!state.playerAnimSet || !state.enemyAnimSet || !state.envAnims) {
    return;
  }

  state.playerAnimSet.update(dt);
  state.enemyAnimSet.update(dt);
  state.envAnims.spikes.update(dt);
  state.envAnims.fountainTop.update(dt);
  state.envAnims.fountainMid.update(dt);
  state.envAnims.fountainBasin.update(dt);
}

function drawFallbackTerrain(renderCtx) {
  const cols = Math.ceil(canvas.width / TILE_RENDER.size);
  const rows = Math.ceil(canvas.height / TILE_RENDER.size);

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const border = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
      const color = border ? "#243244" : (x + y) % 2 === 0 ? "#162337" : "#1b2a40";
      drawRect(renderCtx, x * TILE_RENDER.size, y * TILE_RENDER.size, TILE_RENDER.size, TILE_RENDER.size, color);
    }
  }
}

function drawTerrain(renderCtx) {
  if (!state.tileset) {
    drawFallbackTerrain(renderCtx);
    return;
  }

  const cols = Math.ceil(canvas.width / TILE_RENDER.size);
  const rows = Math.ceil(canvas.height / TILE_RENDER.size);

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const border = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
      const frame = border
        ? pickTile(TERRAIN_TILES.wall, x, y)
        : pickTile(TERRAIN_TILES.floor, x, y);

      drawSpriteFrame(
        renderCtx,
        state.tileset,
        frame,
        x * TILE_RENDER.size,
        y * TILE_RENDER.size,
        TILE_RENDER.size,
        TILE_RENDER.size,
        false,
        { sourceInset: TILE_RENDER.sourceInset }
      );
    }
  }
}

function drawEnvironmentDecor(renderCtx) {
  if (!state.tileset || !state.envAnims) {
    return;
  }

  const fountainX = canvas.width / 2 - TILE_RENDER.size / 2;
  const fountainY = TILE_RENDER.size;

  drawSpriteFrame(renderCtx, state.tileset, state.envAnims.fountainTop.getFrame(), fountainX, fountainY, TILE_RENDER.size, TILE_RENDER.size);
  drawSpriteFrame(renderCtx, state.tileset, state.envAnims.fountainMid.getFrame(), fountainX, fountainY + TILE_RENDER.size, TILE_RENDER.size, TILE_RENDER.size);
  drawSpriteFrame(renderCtx, state.tileset, state.envAnims.fountainBasin.getFrame(), fountainX, fountainY + TILE_RENDER.size * 2, TILE_RENDER.size, TILE_RENDER.size);

  const spikeY = canvas.height - TILE_RENDER.size * 2;
  for (let i = 0; i < 6; i += 1) {
    drawSpriteFrame(
      renderCtx,
      state.tileset,
      state.envAnims.spikes.getFrame(),
      80 + i * TILE_RENDER.size,
      spikeY,
      TILE_RENDER.size,
      TILE_RENDER.size
    );
  }

  drawSpriteFrame(renderCtx, state.tileset, DECOR_FRAMES.banner, 40, 40, TILE_RENDER.size, TILE_RENDER.size);
  drawSpriteFrame(renderCtx, state.tileset, DECOR_FRAMES.skull, canvas.width - 70, 50, TILE_RENDER.size, TILE_RENDER.size);
  drawSpriteFrame(renderCtx, state.tileset, DECOR_FRAMES.crate, canvas.width - 120, canvas.height - 90, TILE_RENDER.size, TILE_RENDER.size * 1.5);
}

function drawBackground(renderCtx, overlay = false) {
  drawTerrain(renderCtx);
  drawEnvironmentDecor(renderCtx);
  if (overlay) {
    drawRect(renderCtx, 0, 0, canvas.width, canvas.height, "rgba(5, 10, 22, 0.6)");
  }
}

function drawPlayer(renderCtx) {
  if (!state.tileset || !state.playerAnimSet) {
    drawRect(renderCtx, player.x, player.y, player.w, player.h, "#38bdf8");
    return;
  }

  drawSpriteFrame(
    renderCtx,
    state.tileset,
    state.playerAnimSet.getCurrentFrame(),
    player.x,
    player.y,
    player.w,
    player.h,
    player.flipX
  );
}

function drawEnemy(renderCtx) {
  if (!state.tileset || !state.enemyAnimSet) {
    drawRect(renderCtx, enemy.x, enemy.y, enemy.w, enemy.h, "#f97316");
    return;
  }

  drawSpriteFrame(
    renderCtx,
    state.tileset,
    state.enemyAnimSet.getCurrentFrame(),
    enemy.x,
    enemy.y,
    enemy.w,
    enemy.h,
    enemy.flipX
  );
}

registerScene("menu", {
  update() {
    if (wasKeyPressed("enter") || wasKeyPressed(" ")) {
      setScene("play", { state, player, enemy });
    }
  },
  render({ ctx: renderCtx }) {
    clearCanvas(renderCtx, "#0a1020");
    drawBackground(renderCtx, true);
    drawText(renderCtx, "Dungeon Starter", canvas.width / 2, 150, {
      size: 48,
      align: "center",
      color: "#e2e8f0",
    });
    drawText(renderCtx, "Press Enter to Start", canvas.width / 2, 230, {
      size: 24,
      align: "center",
      color: "#94a3b8",
    });
    drawText(renderCtx, "Move: WASD / Arrows | F3 Debug", canvas.width / 2, 278, {
      size: 16,
      align: "center",
      color: "#64748b",
    });
  },
});

registerScene("play", {
  enter() {
    player.x = 120;
    player.y = 140;
    enemy.x = 560;
    enemy.dir = 1;
    randomizeEnemyLane();
    randomizeGoal();
  },
  update(dt) {
    state.time += dt;

    let moveX = 0;
    let moveY = 0;

    if (isKeyDown("arrowleft") || isKeyDown("a")) {
      moveX -= 1;
    }
    if (isKeyDown("arrowright") || isKeyDown("d")) {
      moveX += 1;
    }
    if (isKeyDown("arrowup") || isKeyDown("w")) {
      moveY -= 1;
    }
    if (isKeyDown("arrowdown") || isKeyDown("s")) {
      moveY += 1;
    }

    const direction = normalize(moveX, moveY);
    const playerMoving = direction.x !== 0 || direction.y !== 0;
    player.flipX = direction.x < 0;

    if (state.playerAnimSet) {
      state.playerAnimSet.play(playerMoving ? "run" : "idle", false);
    }

    player.x += direction.x * player.speed * dt;
    player.y += direction.y * player.speed * dt;

    player.x = clamp(player.x, 0, canvas.width - player.w);
    player.y = clamp(player.y, 0, canvas.height - player.h);

    enemy.x += enemy.dir * enemy.speed * dt;
    if (enemy.x <= 80) {
      enemy.x = 80;
      enemy.dir = 1;
      enemy.flipX = false;
    }
    if (enemy.x >= canvas.width - enemy.w - 80) {
      enemy.x = canvas.width - enemy.w - 80;
      enemy.dir = -1;
      enemy.flipX = true;
    }

    if (state.enemyAnimSet) {
      state.enemyAnimSet.play("run", false);
    }

    updateAnimations(dt);

    if (aabbIntersect(player, goal) && cooldown("goal", 150)) {
      state.score += 1;
      randomizeGoal();
      randomizeEnemyLane();
    }

    if (wasKeyPressed("escape")) {
      setScene("menu", { state, player, enemy });
    }
  },
  render({ ctx: renderCtx }) {
    clearCanvas(renderCtx, "#0b1327");
    drawBackground(renderCtx);
    drawPlayer(renderCtx);
    drawEnemy(renderCtx);

    if (state.tileset) {
      drawSpriteFrame(renderCtx, state.tileset, GOAL_SPRITE_FRAME, goal.x, goal.y, goal.w, goal.h);
    } else {
      drawRect(renderCtx, goal.x, goal.y, goal.w, goal.h, "#22c55e");
    }

    drawText(renderCtx, `Score: ${state.score}`, 14, 28, { size: 22, color: "#e2e8f0" });
    const mouse = getMousePos();
    drawText(renderCtx, `Mouse: ${Math.round(mouse.x)}, ${Math.round(mouse.y)}`, 14, 52, {
      size: 14,
      color: "#94a3b8",
    });

    drawHitbox(renderCtx, player);
    drawHitbox(renderCtx, goal, "#22c55e");
    drawHitbox(renderCtx, enemy, "#f97316");
  },
});

function update(dt) {
  if (wasKeyPressed("f3")) {
    toggleDebug();
  }

  updateTimers(dt * 1000);
  updateScene(dt, { state, player, enemy, canvas, ctx });
  updateDebug(dt);
  endFrameInput();
}

function render(alpha) {
  renderScene({ ctx, alpha, state, player, enemy, canvas, debug: isDebugEnabled() });
  drawFPS(ctx);

  if (isDebugEnabled()) {
    drawText(ctx, `Scene: ${getCurrentSceneName()}`, 14, canvas.height - 14, {
      size: 13,
      color: "#60a5fa",
    });
  }
}

const loop = createGameLoop({ update, render });

async function boot() {
  clearCanvas(ctx, "#0b1224");
  drawText(ctx, "Loading assets...", canvas.width / 2, canvas.height / 2 - 14, {
    align: "center",
    size: 22,
    color: "#e2e8f0",
  });

  await preloadAssets(ASSETS, (progress) => {
    state.loadingProgress = progress;
    clearCanvas(ctx, "#0b1224");
    drawText(ctx, `Loading ${(progress * 100).toFixed(0)}%`, canvas.width / 2, canvas.height / 2 - 12, {
      align: "center",
      size: 20,
      color: "#e2e8f0",
    });
    drawRect(ctx, canvas.width / 2 - 180, canvas.height / 2 + 16, 360, 12, "#1f2937");
    drawRect(ctx, canvas.width / 2 - 180, canvas.height / 2 + 16, 360 * progress, 12, "#22c55e");
  });

  state.tileset = getImage(TILESET_KEY);

  if (state.tileset) {
    state.playerAnimSet = createCharacterAnimSet(PLAYER_ANIMATIONS, TILESET_KEY, 9);
    state.enemyAnimSet = createCharacterAnimSet(ENEMY_ANIMATIONS, TILESET_KEY, 8);
    state.envAnims = createEnvironmentAnimations(TILESET_KEY);
  } else {
    console.warn("Tileset could not be loaded.");
  }

  state.loading = false;
  setScene("menu", { state, player, enemy });
  loop.start();
}

boot().catch((error) => {
  clearCanvas(ctx, "#1f1020");
  drawText(ctx, "Failed to boot game", canvas.width / 2, canvas.height / 2 - 8, {
    align: "center",
    size: 24,
    color: "#fecaca",
  });
  drawText(ctx, error.message, canvas.width / 2, canvas.height / 2 + 24, {
    align: "center",
    size: 14,
    color: "#fda4af",
  });
  throw error;
});
