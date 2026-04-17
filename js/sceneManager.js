const scenes = new Map();
let currentScene = null;
let currentSceneName = "";

export function registerScene(name, scene) {
  scenes.set(name, scene);
}

export function setScene(name, context) {
  const next = scenes.get(name);
  if (!next) {
    throw new Error(`Scene not found: ${name}`);
  }

  if (currentScene && typeof currentScene.exit === "function") {
    currentScene.exit(context);
  }

  currentScene = next;
  currentSceneName = name;

  if (typeof currentScene.enter === "function") {
    currentScene.enter(context);
  }
}

export function updateScene(dt, context) {
  if (!currentScene || typeof currentScene.update !== "function") {
    return;
  }
  currentScene.update(dt, context);
}

export function renderScene(context) {
  if (!currentScene || typeof currentScene.render !== "function") {
    return;
  }
  currentScene.render(context);
}

export function getCurrentSceneName() {
  return currentSceneName;
}
