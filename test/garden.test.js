import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, checkin, water, harvest, plant, buy, SEEDS } from "../garden.js";

const day = (n) => new Date(2026, 8, 1 + n, 9).getTime(); // Sep 1 + n, 09:00 local

test("streak, tokens, growth, wilt, harvest", () => {
  const s = fresh();
  checkin(s, day(0));
  assert.equal(s.tokens, 11); assert.equal(s.streak, 1);
  checkin(s, day(0) + 1000); // same day, too soon → nothing
  assert.equal(s.tokens, 11);
  checkin(s, day(0) + 2 * 3600_000); // +2h → extra
  assert.equal(s.tokens, 13);
  checkin(s, day(1)); assert.equal(s.streak, 2); assert.equal(s.tokens, 25);
  checkin(s, day(3)); assert.equal(s.streak, 1, "gap resets streak");

  plant(s, "sprout", day(3));
  assert.throws(() => water(s, day(3)) && water(s, day(3)), /Already watered/);
  water(s, day(4)); water(s, day(5));
  assert.equal(s.plant.stage, 3); assert.equal(s.plant.ready, true);
  const before = s.tokens;
  harvest(s);
  assert.equal(s.tokens, before + SEEDS.sprout.harvest); assert.equal(s.plant, null);

  plant(s, "sprout", day(5));
  checkin(s, day(9)); // 4 days no water → wilt
  assert.equal(s.plant.wilted, true);

  assert.throws(() => plant(s, "lotus"), /locked|Already/);
  s.tokens = 30; s.plant = null;
  buy(s, "seed", "sunflower");
  assert.equal(s.tokens, 0); assert.ok(s.unlocked.seeds.includes("sunflower"));
  assert.throws(() => buy(s, "theme", "aurora"), /Need 80/);
});
