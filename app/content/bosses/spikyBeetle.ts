import { enemyDefinitions } from 'app/content/enemies/enemyHash';
import { groundBeetleAnimations, spikedBeetleShell, spikedBeetleBreak, bigBeetleAntenna } from '../enemyAnimations';
import { paceAndCharge} from 'app/utils/enemies';
import { getNearbyTargetAnchor, getVectorToNearbyTarget } from 'app/utils/target';
import { directionMap} from 'app/utils/direction';
import { getFrame } from 'app/utils/animations';
import { throwWebBallAtLocation } from '../effects/webBall';
import { FieldAnimationEffect } from '../effects/animationEffect';
import { addEffectToArea } from 'app/utils/effects';
import { playAreaSound } from 'app/musicController';
import { moveEnemyFull } from 'app/utils/enemies';
const shieldHealthMax = 3
const maxJumpSpeed = 5;

function jumpTowardsPoint(state: GameState, enemy: Enemy, {x: tx, y: ty}: Point) {
    const enemyHitbox = enemy.getHitbox(state);
    const x = enemyHitbox.x + enemyHitbox.w / 2;
    const y = enemyHitbox.y + enemyHitbox.h / 2;
    enemy.vz = 5;
    enemy.az = -0.2;
    // This is in frames.
    const duration = -2 * enemy.vz / enemy.az;
    enemy.vx = (tx - x) / duration;
    enemy.vy = (ty - y) / duration;
    const mag = Math.sqrt(enemy.vx ** 2 + enemy.vy ** 2);
    if (mag > maxJumpSpeed) {
        enemy.vx = maxJumpSpeed * enemy.vx / mag;
        enemy.vy = maxJumpSpeed * enemy.vy / mag;
    }
    console.log("JUMP")
    enemy.setMode('jumping')
}

function onHitBeetle(state: GameState, enemy: Enemy, hit: HitProperties): HitResult {
    if (enemy.params.shellIntact) {
        hit = {
            ...hit,
            damage: 0,
        }; if (hit.hitCircle && !hit.element && enemy.invulnerableFrames == 0) {
            enemy.params.shellHealth -= 1;
            enemy.invulnerableFrames = 50;
        }
        if (enemy.params.shellHealth == 0) {
            let hitbox = enemy.getHitbox();
            const shellBreakAnimation = new FieldAnimationEffect({
                    animation: spikedBeetleBreak,
                    drawPriority: 'foreground',
                    x: hitbox.x,
                    y: hitbox.y,
                    doNotLoop: true,
                });
                addEffectToArea(state, state.areaInstance, shellBreakAnimation);
                playAreaSound(state, state.areaInstance, 'rockShatter');
            enemy.canBeKnockedBack = true;
            enemy.params.shellIntact = false;
        }
    }
    return enemy.defaultOnHit(state, hit);
}

const webBallAbility: EnemyAbility<ReturnType<typeof getVectorToNearbyTarget>> = {
    getTarget(state: GameState, enemy: Enemy) {
            return getVectorToNearbyTarget(state, enemy, enemy.aggroRadius, enemy.area.allyTargets);
    },
    cooldown: 4000,
    initialCharges: 0,
    charges: 1,
    useAbility(state: GameState, enemy: Enemy) {
        const target = getNearbyTargetAnchor(state, enemy, 1000, enemy.area.allyTargets) || {
            x: Math.random() * 16 * enemy.area.w,
            y: Math.random() * 16 * enemy.area.h,
        };
        const theta = 2 * Math.PI * Math.random();
        throwWebBallAtLocation(state, enemy, {
            tx: target.x + 16 * Math.cos(theta),
            ty: target.y + 16 * Math.sin(theta),
        }, { damage: 4, source: enemy });
    },
};

const leapAbility: EnemyAbility<ReturnType<typeof getVectorToNearbyTarget>> = {
    getTarget(state: GameState, enemy: Enemy) {
            return getVectorToNearbyTarget(state, enemy, enemy.aggroRadius, enemy.area.allyTargets);
    },
    cooldown: 4000,
    initialCharges: 0,
    charges: 1,
    useAbility(state: GameState, enemy: Enemy) {
        if (enemy.params.shellIntact) {
            return;
        }
        const target = getNearbyTargetAnchor(state, enemy, 1000, enemy.area.allyTargets);
        if (target) {
            jumpTowardsPoint(state, enemy, { x: target.x, y: target.y });
        }
        enemy.setMode('jumping');   
    },
};

enemyDefinitions.spikedBeetle = {
    naturalDifficultyRating: 5,
    // Reset the boss to its starting position if you leave the arena.
    alwaysReset: true,
    animations: groundBeetleAnimations, scale: 1,
    canBeKnockedBack: false,
    onHit: onHitBeetle,
    acceleration: 0.5, speed: 0.8,
    initialMode: 'idle',
    abilities: [webBallAbility, leapAbility],
    params: {
        shellIntact: true,
        shellHealth: shieldHealthMax,
        breakAnimation: 0,
    },
    renderOver(context: CanvasRenderingContext2D, state: GameState, enemy: Enemy) {
        let index = shieldHealthMax - enemy.params.shellHealth;
        if (enemy.currentAnimationKey === 'break') {
            const frame = getFrame(spikedBeetleBreak, enemy.animationTime);
            enemy.defaultRender(context, state, frame); //WIP: Render shellbreak better
            enemy.params.breakAnimation += 1;
            if (enemy.params.breakAnimation >= 3) {
                enemy.changeToAnimation('walk');
            } //WIP: Implement the breakStop better
        } else {
            enemy.defaultRender(context, state, spikedBeetleShell[index]);
        }
        enemy.defaultRender(context, state, bigBeetleAntenna[0])
    },
    getShieldPercent(state: GameState, enemy: Enemy) {
            return enemy.params.shellHealth / shieldHealthMax;
        },
    life: 12, touchDamage: 2, update: updateSpikedBeetle,
};

function updateSpikedBeetle(state: GameState, enemy: Enemy): void {
    if (enemy.mode === 'jumping') {
        if (!moveEnemyFull(state, enemy, enemy.vx, 0, {})) {
                enemy.vx = -enemy.vx;
            }
            if (!moveEnemyFull(state, enemy, 0, enemy.vy, {})) {
                enemy.vy = -enemy.vy;
            }
            if (enemy.z <= 0) {
                enemy.z = 0;
                enemy.az = -0.5;
                enemy.setMode('recover');
            }
        } else if (enemy.mode === 'recover') {
            if (enemy.modeTime >= 1000) {
                enemy.setMode('walk');
            }
        }
    enemy.useRandomAbility(state);
        if (!enemy.activeAbility && enemy.z <= 0) {
            paceAndCharge(state, enemy); //fix below
            if (enemy.mode === 'walk' && enemy.modeTime < 0) {
                const target = getVectorToNearbyTarget(state, enemy, 128, enemy.area.allyTargets);
                if (target) {
                    const [dx, dy] = directionMap[enemy.d];
                    if (dx * target.x > 0 || dy * target.y > 0) {
                        if (!enemy.params.shellIntact) {
                            enemy.speed = 1.6;
                            enemy.modeTime += 400;
                        }
                    }
                }
            }
        }
    }
