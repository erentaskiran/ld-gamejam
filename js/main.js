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
  MAP_PARSE_CONFIG,
  DECOR_FRAMES,
  ENEMY_ANIMATIONS,
  ENVIRONMENT_ANIMATIONS,
  GOAL_SPRITE_FRAME,
  MAP_CONFIG,
  MAP_TILESET_KEY,
  PLAYER_ANIMATIONS,
  TILESET_META,
  ACTOR_TILESET_KEY,
  TILE_RENDER,
} from "./gameAssets.js";
import { loadTilemap, moveWithCollisions, tileIdToFrame } from "./tilemap.js";

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
  mapTileset: null,
  actorTileset: null,
  playerAnimSet: null,
  enemyAnimSet: null,
  envAnims: null,
  mapData: null,
  mapTilesetMeta: TILESET_META,
};

function setEntityCenter(entity, center) {
  if (!center) {
    return;
  }
  entity.x = center.x - entity.w / 2;
  entity.y = center.y - entity.h / 2;
}

function randomizeGoal() {
  if (state.mapData?.spawns?.goal) {
    setEntityCenter(goal, state.mapData.spawns.goal);
    return;
  }

  const tileSize = getTileRenderSize();
  const rightLimit = state.mapData
    ? state.mapData.mapWidth * tileSize - 60 - goal.w
    : canvas.width - 120 - goal.w;
  const bottomLimit = state.mapData
    ? state.mapData.mapHeight * tileSize - 60 - goal.h
    : canvas.height - 120 - goal.h;

  goal.x = 60 + Math.random() * Math.max(1, rightLimit - 60);
  goal.y = 60 + Math.random() * Math.max(1, bottomLimit - 60);
}

function randomizeEnemyLane() {
  if (state.mapData?.spawns?.enemy) {
    setEntityCenter(enemy, state.mapData.spawns.enemy);
    return;
  }

  const laneTop = 40;
  const laneBottom = Math.max(laneTop + 1, getWorldHeight() - enemy.h - 40);
  enemy.y = laneTop + Math.random() * (laneBottom - laneTop);
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
  const image = getImage(imageName);
  return {
    spikes: createAnimation({
      image,
      frames: ENVIRONMENT_ANIMATIONS.spikes,
      fps: 8,
      loop: true,
      autoPlay: true,
    }),
    fountainTop: createAnimation({
      image,
      frames: ENVIRONMENT_ANIMATIONS.fountainTop,
      fps: 5,
      loop: true,
      autoPlay: true,
    }),
    fountainMid: createAnimation({
      image,
      frames: ENVIRONMENT_ANIMATIONS.fountainMid,
      fps: 5,
      loop: true,
      autoPlay: true,
    }),
    fountainBasin: createAnimation({
      image,
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

function getWorldWidth() {
  return state.mapData ? state.mapData.mapWidth * getTileRenderSize() : canvas.width;
}

function getWorldHeight() {
  return state.mapData ? state.mapData.mapHeight * getTileRenderSize() : canvas.height;
}

function getTileRenderSize() {
  return state.mapData?.tileSize || TILE_RENDER.size;
}

function drawFallbackTerrain(renderCtx) {
  const tileSize = getTileRenderSize();
  const cols = Math.ceil(getWorldWidth() / tileSize);
  const rows = Math.ceil(getWorldHeight() / tileSize);

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const border = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
      const color = border ? "#243244" : (x + y) % 2 === 0 ? "#162337" : "#1b2a40";
      drawRect(renderCtx, x * tileSize, y * tileSize, tileSize, tileSize, color);
    }
  }
}

function drawTerrain(renderCtx) {
  if (!state.mapTileset || !state.mapData) {
    drawFallbackTerrain(renderCtx);
    return;
  }

  const tileSize = getTileRenderSize();

  for (const layer of state.mapData.layers) {
    for (const tile of layer.tiles) {
      const frameMeta = state.mapTilesetMeta || TILESET_META;
      const frame = tileIdToFrame(tile.id, frameMeta);
      if (!frame) {
        continue;
      }

      drawSpriteFrame(renderCtx, state.mapTileset, frame, tile.x * tileSize, tile.y * tileSize, tileSize, tileSize, false, {
        sourceInset: TILE_RENDER.sourceInset,
      });
    }
  }
}

function drawEnvironmentDecor(renderCtx) {
  if (!state.actorTileset || !state.envAnims) {
    return;
  }

  const tileSize = getTileRenderSize();
  const fountainX = canvas.width / 2 - tileSize / 2;
  const fountainY = tileSize;

  drawSpriteFrame(renderCtx, state.actorTileset, state.envAnims.fountainTop.getFrame(), fountainX, fountainY, tileSize, tileSize);
  drawSpriteFrame(renderCtx, state.actorTileset, state.envAnims.fountainMid.getFrame(), fountainX, fountainY + tileSize, tileSize, tileSize);
  drawSpriteFrame(renderCtx, state.actorTileset, state.envAnims.fountainBasin.getFrame(), fountainX, fountainY + tileSize * 2, tileSize, tileSize);

  const spikeY = canvas.height - tileSize * 2;
  for (let i = 0; i < 6; i += 1) {
    drawSpriteFrame(
      renderCtx,
      state.actorTileset,
      state.envAnims.spikes.getFrame(),
      80 + i * tileSize,
      spikeY,
      tileSize,
      tileSize
    );
  }

  drawSpriteFrame(renderCtx, state.actorTileset, DECOR_FRAMES.banner, 40, 40, tileSize, tileSize);
  drawSpriteFrame(renderCtx, state.actorTileset, DECOR_FRAMES.skull, canvas.width - 70, 50, tileSize, tileSize);
  drawSpriteFrame(renderCtx, state.actorTileset, DECOR_FRAMES.crate, canvas.width - 120, canvas.height - 90, tileSize, tileSize * 1.5);
}

function drawBackground(renderCtx, overlay = false) {
  drawTerrain(renderCtx);
  if (!state.mapData) {
    drawEnvironmentDecor(renderCtx);
  }
  if (overlay) {
    drawRect(renderCtx, 0, 0, getWorldWidth(), getWorldHeight(), "rgba(5, 10, 22, 0.6)");
  }
}

function drawPlayer(renderCtx) {
  if (!state.actorTileset || !state.playerAnimSet) {
    drawRect(renderCtx, player.x, player.y, player.w, player.h, "#38bdf8");
    return;
  }

  drawSpriteFrame(
    renderCtx,
    state.actorTileset,
    state.playerAnimSet.getCurrentFrame(),
    player.x,
    player.y,
    player.w,
    player.h,
    player.flipX
  );
}

function drawEnemy(renderCtx) {
  if (!state.actorTileset || !state.enemyAnimSet) {
    drawRect(renderCtx, enemy.x, enemy.y, enemy.w, enemy.h, "#f97316");
    return;
  }

  drawSpriteFrame(
    renderCtx,
    state.actorTileset,
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
    if (state.mapData?.spawns?.player) {
      setEntityCenter(player, state.mapData.spawns.player);
    }

    enemy.x = Math.max(80, getWorldWidth() - enemy.w - 80);
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

    moveWithCollisions(
      player,
      direction.x * player.speed * dt,
      direction.y * player.speed * dt,
      state.mapData
    );

    player.x = clamp(player.x, 0, getWorldWidth() - player.w);
    player.y = clamp(player.y, 0, getWorldHeight() - player.h);

    enemy.x += enemy.dir * enemy.speed * dt;
    if (enemy.x <= 80) {
      enemy.x = 80;
      enemy.dir = 1;
      enemy.flipX = false;
    }
    if (enemy.x >= getWorldWidth() - enemy.w - 80) {
      enemy.x = getWorldWidth() - enemy.w - 80;
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

    if (state.actorTileset) {
      drawSpriteFrame(renderCtx, state.actorTileset, GOAL_SPRITE_FRAME, goal.x, goal.y, goal.w, goal.h);
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

  state.mapTileset = getImage(MAP_TILESET_KEY);
  state.actorTileset = getImage(ACTOR_TILESET_KEY);
  state.mapData = await loadTilemap(MAP_CONFIG.path, MAP_PARSE_CONFIG).catch(() => null);

  if (state.mapData) {
    state.mapTilesetMeta = state.mapData.tileset || TILESET_META;
    canvas.width = state.mapData.mapWidth * getTileRenderSize();
    canvas.height = state.mapData.mapHeight * getTileRenderSize();
  } else {
    state.mapTilesetMeta = TILESET_META;
  }

  if (state.actorTileset) {
    state.playerAnimSet = createCharacterAnimSet(PLAYER_ANIMATIONS, ACTOR_TILESET_KEY, 9);
    state.enemyAnimSet = createCharacterAnimSet(ENEMY_ANIMATIONS, ACTOR_TILESET_KEY, 8);
    state.envAnims = createEnvironmentAnimations(ACTOR_TILESET_KEY);
  } else {
    console.warn("Actor tileset could not be loaded.");
  }

  if (!state.mapTileset) {
    console.warn("Map tileset could not be loaded.");
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
