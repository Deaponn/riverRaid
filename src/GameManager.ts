import TextureManager from "./TextureManager";
import FrameRenderer from "./FrameRenderer";
import Engine from "./Engine";
import opponents, { Opponent } from "./opponents";
import { Keys } from "./InputManager";
import constants from "./Constants";
import SoundManager from "./SoundManager";

export interface PlayerData {
    points: number;
    lifes: number;
    fuel: number;
    highscore: number;
    gameId: number;
    bridge: number;
}

export default class GameManager {
    private readonly textureManager: TextureManager;
    private readonly context: CanvasRenderingContext2D;
    private readonly pressedKeys: Keys;
    private readonly playerData: PlayerData = {
        lifes: 3,
        points: 0,
        highscore: parseInt(localStorage.getItem("highscore") || "0"),
        fuel: 100,
        bridge: 1,
        gameId: 1,
    };
    private readonly bridgeDistances = [458, 3316, 6176, 9028, 11866, 14698, 17554, 20404, 23258, 26112];
    private readonly bridgeCenters = [400, 406, 378, 410, 373, 363, 426, 442, 433, 385];
    private readonly soundPlayer: SoundManager;
    private engine: Engine;
    private frameRenderer: FrameRenderer;
    private currentBridgeDistance = 458; // 458
    private slidingAnimationStart = 0;
    private slidingStartPoint = 0; // 0
    private playerDeathTimestamp: number | null;
    private previousTimestamp: number | null;
    private slideShowId: number;

    constructor(
        context: CanvasRenderingContext2D,
        frameRenderer: FrameRenderer,
        textureManager: TextureManager,
        pressedKeys: Keys,
        soundPlayer: SoundManager,
    ) {
        this.context = context;
        this.textureManager = textureManager;
        this.soundPlayer = soundPlayer;
        this.frameRenderer = frameRenderer;
        this.pressedKeys = pressedKeys;
        this.bootUp();
    }

    bootUp(prevTimestamp: number | null = null) {
        this.currentBridgeDistance = 458; // 458
        this.slidingAnimationStart = prevTimestamp || 0;
        this.slidingStartPoint = 0; // 0
        this.playerDeathTimestamp = null;
        this.previousTimestamp = prevTimestamp;
        this.engine = new Engine(
            this.context,
            JSON.parse(JSON.stringify(opponents)),
            this.textureManager.getSprite.bind(this.textureManager),
            (entityType: string) => {
                this.playerKilled(entityType);
            },
            () => {
                this.refillFuel();
            },
            this.soundPlayer
        );
        this.frameRenderer.blackout();
        this.frameRenderer.drawInterface(this.playerData);
        const enemiesCopy = JSON.parse(JSON.stringify(opponents)) as Opponent[];
        this.engine.putEnemiesData(enemiesCopy);
        this.engine.showcasing = true;
        document.body.addEventListener(
            "keydown",
            () => {
                this.soundPlayer.playSound("boot");
                cancelAnimationFrame(this.slideShowId);
                this.engine.setDistance(0);
                this.engine.showcasing = false;
                this.slideIntoView(0, 458, 0.6);
                this.frameRenderer.gameStarted = true;
            },
            { once: true }
        );
        this.slideShow(0);
        this.frameRenderer.drawTextAnimation(0);
        // first bridge: 458, second bridge: 3316, third bridge: 6176, fourth bridge: 9028,
        // fifth bridge: 11866, sixth bridge: 14698, seventh bridge: 17554, eigth bridge: 20404,
        // ninth bridge: 23258, tenth bridge: 26112
    }

    playerKilled(entityType: string) {
        // this.playerData.points += points;
        this.soundPlayer.playSound("enemyDeath");
        const oldPoints = this.playerData.points;
        switch (entityType) {
            case "helicopter": {
                this.playerData.points += 60;
                break;
            }
            case "shootingHelicopter": {
                this.playerData.points += 150;
                break;
            }
            case "ship": {
                this.playerData.points += 30;
                break;
            }
            case "balloon": {
                this.playerData.points += 60;
                break;
            }
            case "plane": {
                this.playerData.points += 100;
                break;
            }
            case "tank": {
                this.playerData.points += 250;
                break;
            }
            case "fuel": {
                this.playerData.points += 80;
                break;
            }
            case "bridge": {
                this.playerData.points += 500;
                this.riverBlink();
                break;
            }
            default: {
                console.log("unknown entity killed: ", entityType);
            }
        }
        if (oldPoints % 10000 > this.playerData.points % 10000) this.playerData.lifes++;
    }

    refillFuel() {
        this.playerData.fuel = Math.min(100, (this.playerData.fuel += 0.2));
        if (this.playerData.fuel === 100) this.soundPlayer.playSound("tankingFull");
        else this.soundPlayer.playSound("tanking");
    }

    slideShow(timestamp: number, toWhere: number = 28508, speed: number = 0.1) {
        const currentDistance = timestamp * speed;
        this.engine.setDistance(currentDistance);
        this.frameRenderer.drawMap(currentDistance);
        const offset = currentDistance;
        this.engine.updateEntities(currentDistance - offset);
        this.engine.spawnEnemy(this.engine.testNewEnemy());
        this.frameRenderer.draw(this.engine.getData(), this.playerData);
        this.slidingAnimationStart = timestamp;
        if (currentDistance < toWhere) {
            this.slideShowId = requestAnimationFrame((timestamp) => {
                this.slideShow(timestamp, toWhere, speed);
            });
        }
    }

    riverBlink() {
        this.frameRenderer.blink();
    }

    slideIntoView(timestamp: number, toWhere: number, speed: number) {
        const currentDistance = (timestamp - this.slidingAnimationStart) * speed + this.slidingStartPoint;
        const offset = currentDistance - toWhere;
        this.engine.setDistance(currentDistance);
        this.frameRenderer.drawMap(toWhere, offset);
        this.engine.spawnEnemy(this.engine.testNewEnemy());
        this.frameRenderer.draw(this.engine.getData(), this.playerData);
        if (currentDistance < toWhere)
            requestAnimationFrame((timestamp) => {
                this.slideIntoView(timestamp, toWhere, speed);
            });
        else {
            this.frameRenderer.drawMap(toWhere);
            this.engine.setDistance(toWhere);
            this.engine.spawnEnemy(this.engine.testNewEnemy());
            this.engine.addPlayer(this.bridgeCenters[this.playerData.bridge - 1]);
            this.frameRenderer.draw(this.engine.getData(), this.playerData);
            document.body.addEventListener("keydown", this.startTheGame.bind(this), { once: true });
        }
    }

    startTheGame() {
        const enemiesCopy = JSON.parse(JSON.stringify(opponents)) as Opponent[];
        this.previousTimestamp = null;
        this.engine.beginGame(
            enemiesCopy.filter((enemy: Opponent) => {
                return enemy.positionY - 218 > this.currentBridgeDistance;
            }),
            this.bridgeCenters[this.playerData.bridge - 1]
        );
        this.soundPlayer.playSound("flightStart");
        this.draw(0);
    }

    draw(timestamp: number) {
        // this.context.imageSmoothingEnabled = false;
        if (!this.previousTimestamp) this.previousTimestamp = timestamp;
        const delta = timestamp - this.previousTimestamp;
        this.previousTimestamp = timestamp;
        this.checkIfPlayerDied(timestamp);
        this.frameUpdate(delta);
        if (!this.playerDeathTimestamp || timestamp - this.playerDeathTimestamp < 1000) {
            requestAnimationFrame((timestamp) => {
                this.draw(timestamp);
            });
        } else {
            this.engine.entities.length = 0;
            this.playerDeathTimestamp = null;
            this.slidingAnimationStart = timestamp;
            const enemiesCopy = JSON.parse(JSON.stringify(opponents)) as Opponent[];
            this.engine.putEnemiesData(
                enemiesCopy.filter((enemy: Opponent) => {
                    return enemy.positionY - 218 > this.currentBridgeDistance && enemy.positionY - 218 < this.currentBridgeDistance + constants.HEIGHT;
                })
            );
            this.slideIntoView(timestamp, this.currentBridgeDistance, 0.3);
        }
    }

    frameUpdate(delta: number) {
        if (!this.playerDeathTimestamp) {
            this.playerData.fuel = Math.max(0, this.playerData.fuel - delta / 500);
            if (this.playerData.fuel < 25) this.soundPlayer.playSound("lowFuel");
        }
        for (let i = 0; i < this.bridgeDistances.length; i++) {
            if (this.bridgeDistances[i] > this.engine.getDistance()) break;
            else this.playerData.bridge = i + 1;
        }
        if (this.playerData.fuel === 0 && this.engine.getPlayerAlive()) this.engine.destroyEntity(this.engine.findPlayer()!.id);
        if (this.bridgeDistances[this.playerData.bridge] < this.engine.getDistance()) this.playerData.bridge++;
        this.frameRenderer.drawMap(this.engine.getDistance());
        this.engine.triggerRefresh(delta / 10, this.pressedKeys);
        this.frameRenderer.draw(this.engine.getData(), this.playerData);
    }

    frameUpdateForSlideShow(delta: number) {
        this.frameRenderer.drawMap(this.engine.getDistance());
        this.engine.triggerRefresh(delta / 10, this.pressedKeys);
        this.frameRenderer.draw(this.engine.getData(), this.playerData);
    }

    // below method works only once, on player death
    checkIfPlayerDied(timestamp: number) {
        if (!this.playerDeathTimestamp && !this.engine.getPlayerAlive()) {
            this.currentBridgeDistance = this.bridgeDistances[this.playerData.bridge - 1];
            this.slidingStartPoint = this.currentBridgeDistance - 458;
            this.playerDeathTimestamp = timestamp;
            this.playerData.lifes--;
            this.playerData.fuel = 100;
            if (this.playerData.lifes === -1) this.gameOver();
        }
    }

    gameOver() {
        this.saveScore();
    }

    saveScore() {
        const highscore = localStorage.getItem("highscore");
        if (!highscore || parseInt(highscore) < this.playerData.points) {
            localStorage.setItem("highscore", this.playerData.points.toString());
            this.playerData.highscore = this.playerData.points;
            this.playerData.points = 0;
        }
    }
}
