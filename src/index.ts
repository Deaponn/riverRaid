import GameManager from "./GameManager";
import InputManager from "./InputManager";
import constants from "./Constants";
import SoundManager from "./SoundManager";
import TextureManager from "./TextureManager";
import FrameRenderer from "./FrameRenderer";

function setDimensions(canvas: HTMLCanvasElement) {
    canvas.width = constants.WIDTH;
    canvas.height = constants.HEIGHT;
}

const gameCanvas: HTMLCanvasElement = document.getElementById("main") as HTMLCanvasElement;
const context = gameCanvas.getContext("2d") as CanvasRenderingContext2D;
const interfaceCanvas: HTMLCanvasElement = document.getElementById("interface") as HTMLCanvasElement;
const interfaceContext = interfaceCanvas.getContext("2d") as CanvasRenderingContext2D;
const backgroundCanvas: HTMLCanvasElement = document.getElementById("background") as HTMLCanvasElement;
const backgroundContext = backgroundCanvas.getContext("2d") as CanvasRenderingContext2D;
context.imageSmoothingEnabled = false;

setDimensions(gameCanvas);
setDimensions(interfaceCanvas);
setDimensions(backgroundCanvas);
window.onresize = () => {
    setDimensions(gameCanvas);
    setDimensions(interfaceCanvas);
    setDimensions(backgroundCanvas);
};

const soundManager = new SoundManager();
const textureManager = new TextureManager();

async function firstRun() {
    await soundManager.load();
    await textureManager.load();
    soundManager.playSound("boot");
    const frameRenderer = new FrameRenderer(context, interfaceContext, backgroundContext, textureManager.textures)
    new GameManager(context, frameRenderer, textureManager, inputManager.getKeys(), soundManager)
}

firstRun();

const inputManager = new InputManager(document.body);
