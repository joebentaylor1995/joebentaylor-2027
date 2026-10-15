import Matter from 'matter-js';

// Physics world
// ------------
const { Bodies, Body, Composite, Constraint, Engine, Query, Sleeping } = Matter;
export const STEP = 1000 / 120;
const WALL = 160;
const EDGE = 8;
const DRAG_STIFFNESS = 0.18;
const SPEED_LIMIT = 24;
const INTRO_GAP = 32;
const INTRO_STAGGER = 85;

interface PhysicsItem {
	x: number;
	y: number;
	width: number;
	height: number;
	label: string;
	angle?: number;
}

export function createPhysics(width: number, height: number, items: PhysicsItem[], { intro = false } = {}) {
	const engine = Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 });
	engine.gravity.y = 1.5;
	let walls: Matter.Body[] = [];
	let drag: Matter.Constraint | null = null;
	let selected: Matter.Body | null | undefined = null;
	let entering = intro;
	const bodies = items.map(item =>
		Bodies.rectangle(item.x, item.y, item.width, item.height, {
			label: item.label,
			angle: item.angle ?? 0,
			chamfer: { radius: Math.min(16, item.height / 4) },
			restitution: 0.32,
			friction: 0.65,
			frictionStatic: 0.9,
			frictionAir: 0.012,
		})
	);
	if (intro) {
		bodies.forEach((body, index) => {
			const halfHeight = (body.bounds.max.y - body.bounds.min.y) / 2;
			Body.setPosition(body, { x: body.position.x, y: -halfHeight - INTRO_GAP - index * INTRO_STAGGER });
		});
	}
	Composite.add(engine.world, bodies);
	function closeCeiling() {
		const ceiling = Bodies.rectangle(width / 2, -WALL / 2, width + WALL * 2, WALL, { isStatic: true });
		walls.push(ceiling);
		Composite.add(engine.world, ceiling);
	}
	function resize(nextWidth: number, nextHeight: number) {
		width = nextWidth;
		height = nextHeight;
		for (const wall of walls) Composite.remove(engine.world, wall);
		const top = entering ? Math.min(0, ...bodies.map(body => body.bounds.min.y)) - WALL : 0;
		const wallHeight = height - top + WALL * 2;
		const wallCentre = (height + top) / 2;
		walls = [
			Bodies.rectangle(width / 2, height + WALL / 2 - EDGE, width + WALL * 2, WALL, { isStatic: true }),
			Bodies.rectangle(-WALL / 2 + EDGE, wallCentre, WALL, wallHeight, { isStatic: true }),
			Bodies.rectangle(width + WALL / 2 - EDGE, wallCentre, WALL, wallHeight, { isStatic: true }),
		];
		Composite.add(engine.world, walls);
		if (!entering) closeCeiling();
		for (const body of bodies) {
			const halfWidth = (body.bounds.max.x - body.bounds.min.x) / 2;
			const halfHeight = (body.bounds.max.y - body.bounds.min.y) / 2;
			Body.setPosition(body, {
				x: Math.max(halfWidth + EDGE, Math.min(width - halfWidth - EDGE, body.position.x)),
				y: entering
					? body.position.y
					: Math.max(halfHeight, Math.min(height - halfHeight - EDGE, body.position.y)),
			});
			Sleeping.set(body, false);
		}
	}
	function release() {
		if (drag) Composite.remove(engine.world, drag);
		drag = null;
		selected = null;
	}
	function grab(point: Matter.Vector, index?: number) {
		release();
		selected = index === undefined ? Query.point(bodies, point).at(-1) : bodies[index];
		if (!selected) return null;
		Sleeping.set(selected, false);
		drag = Constraint.create({
			pointA: { ...point },
			bodyB: selected,
			pointB: { x: point.x - selected.position.x, y: point.y - selected.position.y },
			length: 0,
			stiffness: DRAG_STIFFNESS,
			damping: 0.15,
		});
		Composite.add(engine.world, drag);
		return selected;
	}
	resize(width, height);
	return {
		bodies,
		grab,
		release,
		resize,
		move(point: Matter.Vector) {
			if (drag) {
				drag.pointA.x = Math.max(EDGE, Math.min(width - EDGE, point.x));
				drag.pointA.y = Math.max(EDGE, Math.min(height - EDGE, point.y));
				if (selected) Sleeping.set(selected, false);
			}
		},
		step() {
			for (const body of bodies) {
				if (body.speed > SPEED_LIMIT)
					Body.setVelocity(body, {
						x: (body.velocity.x * SPEED_LIMIT) / body.speed,
						y: (body.velocity.y * SPEED_LIMIT) / body.speed,
					});
			}
			Engine.update(engine, STEP);
			if (entering && bodies.every(body => body.bounds.min.y >= 0)) {
				entering = false;
				closeCeiling();
			}
		},
		get active() {
			return Boolean(drag) || bodies.some(body => !body.isSleeping);
		},
		destroy() {
			release();
			Composite.clear(engine.world, false);
			Engine.clear(engine);
		},
	};
}
