const { test, before, after, beforeEach, describe } = require("node:test");
const assert = require("node:assert/strict");
const { startApp } = require("./helpers");

let t, gemini, openaiSearch, spoonacular, jobs, dishCheck, restaurants;
const real = {};
before(async () => {
  t = await startApp();
  gemini = require("../../lib/gemini");
  openaiSearch = require("../../lib/providers/openaiSearch");
  spoonacular = require("../../lib/providers/spoonacular");
  jobs = require("../../lib/jobs");
  dishCheck = require("../../lib/dishCheck");
  restaurants = require("../../lib/restaurantCheck");
  Object.assign(real, { gemini: gemini.generateJson, web: openaiSearch.webSearch, spoon: spoonacular.searchIngredients, menuFromUrl: restaurants.menuFromUrl });
});
after(async () => {
  gemini.generateJson = real.gemini;
  openaiSearch.webSearch = real.web;
  spoonacular.searchIngredients = real.spoon;
  restaurants.menuFromUrl = real.menuFromUrl;
  await t.stop();
});

let calls;
beforeEach(async () => {
  calls = { gemini: [], web: [], spoon: [] };
  delete process.env.OPENAI_API_KEY;
  delete process.env.SPOONACULAR_API_KEY;
  process.env.GEMINI_RECEIPTS_API_KEY = "test-key";
  restaurants.menuFromUrl = real.menuFromUrl;
  spoonacular.searchIngredients = async (query) => { calls.spoon.push(query); return []; };
  jobs.clear();
  await t.db.DishChecks.destroy({ where: {} });
  await t.db.RecipeStats.destroy({ where: {} });
  await t.db.RestaurantChecks.destroy({ where: {} });
  await t.db.AiUsages.destroy({ where: {} });
});

const today = () => new Date().toISOString().slice(0, 10);

// Fake Gemini: picks an answer by what's being asked
function fakeGemini({ chances = {}, menu, kitchen, photo, voice, failDishes = false } = {}) {
  gemini.generateJson = async (args) => {
    calls.gemini.push(args);
    if (args.system.includes("assess restaurant dishes")) {
      if (failDishes) throw Object.assign(new Error("overloaded"), { status: 503 });
      const lines = args.prompt.split("\n").slice(1);
      return { data: { dishes: lines.map((line, index) => {
        const name = line.replace(/^\d+: /, "").split(" — ")[0].toLowerCase();
        const chance = chances[name] !== undefined ? chances[name] : 20;
        return { index, gluten_chance: chance, reason: `${name} reason`, sources: [`${name} sauce`], questions: [`Is the ${name} sauce gluten-free?`] };
      }) } };
    }
    if (args.system.includes("extract a restaurant's food menu")) return { data: menu };
    if (args.system.includes("handles gluten")) return { data: kitchen };
    if (args.system.includes("photo of a restaurant menu")) return { data: photo };
    if (args.system.includes("listen to a short recording")) return { data: voice };
    throw new Error(`unexpected prompt: ${args.system.slice(0, 40)}`);
  };
}

async function runJob(res, cookie) {
  assert.equal(res.status, 202, JSON.stringify(res.body));
  await jobs.settle(res.body.job);
  return t.request("GET", `/api/gluten/jobs/${res.body.job}`, { cookie });
}

describe("dish analysis", () => {
  test("combines the menu's words, the AI and caution", async () => {
    fakeGemini({ chances: { "chicken tikka masala": 10, "butter chicken": 5, "grilled salmon": 2, "fish and chips": 95, "veggie curry": 40 } });
    const dishes = await dishCheck.analyzeDishes([
      { name: "Chicken Tikka Masala", description: "Served with garlic naan" },
      { name: "Butter Chicken", description: "Gluten-free. Creamy tomato sauce" },
      { name: "Grilled Salmon", description: "Lemon, herbs" },
      { name: "Fish and Chips", description: "Beer battered cod" },
      { name: "Veggie Curry" },
      { name: "Crispy Potatoes", description: "Fried potatoes" }
    ]);
    const by = Object.fromEntries(dishes.map((d) => [d.name, d]));
    assert.equal(by["Chicken Tikka Masala"].verdict, "likely_gluten");
    assert.equal(by["Chicken Tikka Masala"].basis, "menu");
    assert.match(by["Chicken Tikka Masala"].reason, /naan/i);
    assert.equal(by["Butter Chicken"].verdict, "low_risk");
    assert.match(by["Butter Chicken"].cautions[0], /Marked gluten-free/);
    assert.equal(by["Grilled Salmon"].verdict, "low_risk");
    assert.equal(by["Fish and Chips"].verdict, "likely_gluten");
    assert.equal(by["Veggie Curry"].verdict, "ask");
    assert.deepEqual(by["Veggie Curry"].questions, ["Is the veggie curry sauce gluten-free?"]);
    // fried food is never low risk without asking about the fryer
    assert.equal(by["Crispy Potatoes"].verdict, "ask");
    assert.ok(by["Crispy Potatoes"].cautions.some((c) => /fryer/.test(c)));
    assert.equal(calls.gemini.length, 1, "one batched AI call");
  });

  test("checks are shared: a dish is only asked about once", async () => {
    fakeGemini({ chances: { "pad thai": 70 } });
    await dishCheck.analyzeDishes([{ name: "Pad Thai" }]);
    const [again] = await dishCheck.analyzeDishes([{ name: "pad thai $14.50" }]);
    assert.equal(again.gluten_chance, 70);
    assert.equal(calls.gemini.length, 1);
  });

  test("when the AI fails, dishes are unknown (treated as gluten) and tried again next time", async () => {
    fakeGemini({ failDishes: true });
    const [dish] = await dishCheck.analyzeDishes([{ name: "House Special" }]);
    assert.equal(dish.verdict, "unknown");
    assert.match(dish.reason, /Assume it contains gluten/);
    assert.equal(await t.db.DishChecks.count(), 0);
    fakeGemini({ chances: { "house special": 30 } });
    assert.equal((await dishCheck.analyzeDishes([{ name: "House Special" }]))[0].verdict, "ask");
  });

  test("published recipes can raise a dish's gluten chance, never lower it", async () => {
    process.env.SPOONACULAR_API_KEY = "test";
    fakeGemini({ chances: { "pad thai": 30, "beef stew": 50, "pizza": 99 } });
    spoonacular.searchIngredients = async (query) => {
      calls.spoon.push(query);
      if (query === "pad thai") {
        return [
          ...Array.from({ length: 6 }, (_, i) => ({ title: `Easy Pad Thai ${i}`, source_url: `https://example.com/${i}`, gluten_free: false, ingredients: ["rice noodles", "soy sauce", "egg"] })),
          ...Array.from({ length: 3 }, (_, i) => ({ title: `Pad Thai ${i}`, source_url: null, gluten_free: true, ingredients: ["rice noodles", "tamari"] })),
          { title: "Chocolate cake", source_url: null, gluten_free: false, ingredients: ["flour"] } // not about this dish
        ];
      }
      return [{ title: "Beef stew", source_url: null, gluten_free: true, ingredients: ["beef", "potato"] }];
    };
    const dishes = await dishCheck.analyzeDishes([{ name: "Pad Thai" }, { name: "Beef Stew" }, { name: "Pizza" }]);
    const padThai = dishes[0];
    assert.deepEqual([padThai.recipes.checked, padThai.recipes.with_gluten, padThai.recipes.percent], [9, 6, 67]);
    assert.equal(padThai.gluten_chance, 67);
    assert.equal(padThai.verdict, "likely_gluten");
    assert.equal(padThai.basis, "ai+recipes");
    assert.deepEqual(padThai.recipes.examples[0].gluten, ["soy sauce"]);
    // too few recipes found: the AI's view stands
    assert.equal(dishes[1].recipes, null);
    assert.equal(dishes[1].gluten_chance, 50);
    // plainly gluten dishes aren't worth a lookup
    assert.deepEqual(calls.spoon.sort(), ["beef stew", "pad thai"]);

    // saved for everyone
    calls.spoon = [];
    await dishCheck.analyzeDishes([{ name: "Pad Thai" }]);
    assert.deepEqual(calls.spoon, []);
  });

  test("only a few dishes are cross-checked per request", async () => {
    process.env.SPOONACULAR_API_KEY = "test";
    process.env.RECIPE_CROSS_CHECKS = "2";
    fakeGemini();
    await dishCheck.analyzeDishes(["Dish one", "Dish two", "Dish three", "Dish four"].map((name) => ({ name })));
    assert.equal(calls.spoon.length, 2);
    delete process.env.RECIPE_CROSS_CHECKS;
  });

  test("the overall score can't beat the kitchen's cross-contact level", () => {
    const dishes = [...Array(8).fill({ verdict: "low_risk" }), { verdict: "ask" }, { verdict: "likely_gluten" }];
    assert.deepEqual(dishCheck.scoreMenu(dishes, "lower", false).overall_score, 80);
    const high = dishCheck.scoreMenu(dishes, "high", false);
    assert.deepEqual([high.ingredient_score, high.overall_score, high.capped], [80, 40, true]);
    assert.equal(dishCheck.scoreMenu(dishes, "moderate", true).overall_score, 40);
    assert.equal(dishCheck.scoreMenu(dishes, "very_high", true).overall_score, 0);
    assert.equal(dishCheck.scoreMenu(dishes, "made-up", false).overall_score, 40); // unknown level = high
    assert.equal(dishCheck.scoreMenu(dishes, null, false).overall_score, undefined); // a photo has no kitchen info
  });
});

describe("restaurant check", () => {
  const menu = {
    restaurant_name: "Sunny Thai", location: "Pasadena, CA", menu_url: "https://sunnythai.example/menu",
    dishes: [{ name: "Pad Thai", description: "Rice noodles, tamarind" }, { name: "Green Curry" }, { name: "Spring Rolls", description: "Crispy fried rolls" }, { name: "Mango Sticky Rice" }]
  };
  const kitchen = {
    level: "lower", summary: "Has a GF menu.", gf_menu: "yes", dedicated_fryer: "unknown",
    findings: [
      { text: "Offers a gluten-free menu.", tone: "good", source_url: "https://findmeglutenfree.example/sunny" },
      { text: "Made-up claim.", tone: "good", source_url: "https://not-cited.example/" }
    ]
  };
  const fakeWeb = (citations) => {
    openaiSearch.webSearch = async (prompt) => { calls.web.push(prompt); return { text: "notes", citations: citations(prompt) }; };
  };

  test("needs a name or link, and name search needs web search switched on", async () => {
    const { cookie } = await t.login("Alice");
    assert.equal((await t.request("POST", "/api/gluten/restaurant", { cookie, body: {} })).status, 422);
    assert.equal((await t.request("POST", "/api/gluten/restaurant", { cookie, body: { url: "ftp://x" } })).status, 422);
    const res = await t.request("POST", "/api/gluten/restaurant", { cookie, body: { name: "Sunny Thai" } });
    assert.equal(res.status, 503);
    assert.match(res.body.error, /Paste a link/);
    assert.equal((await t.request("POST", "/api/gluten/restaurant", { body: { name: "x" } })).status, 401);
  });

  test("finds the menu and kitchen info, keeps only cited sources, and scores both", async () => {
    process.env.OPENAI_API_KEY = "test";
    fakeGemini({ chances: { "pad thai": 70, "green curry": 30, "spring rolls": 90, "mango sticky rice": 5 }, menu, kitchen });
    fakeWeb((prompt) => (prompt.includes("food menu")
      ? [{ url: "https://sunnythai.example/menu", title: "Menu" }]
      : [{ url: "https://findmeglutenfree.example/sunny", title: "FMGF" }]));
    const { cookie } = await t.login("Alice");
    const res = await runJob(await t.request("POST", "/api/gluten/restaurant", { cookie, body: { name: "Sunny Thai", city: "Pasadena", local_date: today() } }), cookie);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.restaurant.name, "Sunny Thai");
    assert.equal(res.body.dishes.length, 4);
    assert.equal(res.body.cross_contact.level, "lower");
    assert.deepEqual(res.body.cross_contact.findings.map((f) => f.source_url), ["https://findmeglutenfree.example/sunny"]);
    assert.equal(res.body.score.ingredient_score, 25); // only mango sticky rice is low risk
    assert.equal(res.body.score.overall_score, 25);
    assert.deepEqual(res.body.sources.map((s) => s.label), ["Menu", "Gluten-free info"]);
    assert.match(res.body.disclaimer, /not medical advice/);
    assert.equal(res.body.cached, false);
    assert.equal(res.body.remaining, 2);
    assert.equal(calls.web.length, 2);

    // the same restaurant again comes from the shared cache: no searches, no quota
    const bob = await t.login("Bob");
    const again = await runJob(await t.request("POST", "/api/gluten/restaurant", { cookie: bob.cookie, body: { name: "sunny thai", city: "pasadena" } }), bob.cookie);
    assert.equal(again.body.cached, true);
    assert.equal(again.body.remaining, 3);
    assert.equal(calls.web.length, 2);

    // jobs are private
    const post = await t.request("POST", "/api/gluten/restaurant", { cookie, body: { name: "Sunny Thai", city: "Pasadena" } });
    await jobs.settle(post.body.job);
    assert.equal((await t.request("GET", `/api/gluten/jobs/${post.body.job}`, { cookie: bob.cookie })).status, 404);
  });

  test("Strict mode tightens the cap", async () => {
    process.env.OPENAI_API_KEY = "test";
    fakeGemini({ chances: { "pad thai": 5, "green curry": 5, "spring rolls": 5, "mango sticky rice": 5 }, menu, kitchen: { ...kitchen, level: "moderate" } });
    fakeWeb(() => [{ url: "https://findmeglutenfree.example/sunny", title: "FMGF" }, { url: "https://sunnythai.example/menu", title: "Menu" }]);
    const { cookie } = await t.login("Alice");
    await t.request("PATCH", "/api/me/settings", { cookie, body: { celiac_mode: true, celiac_strict: true } });
    const res = await runJob(await t.request("POST", "/api/gluten/restaurant", { cookie, body: { name: "Sunny Thai" } }), cookie);
    // the spring rolls are fried, so 3 of 4 are low risk; strict caps "moderate" at 40
    assert.deepEqual([res.body.score.ingredient_score, res.body.score.overall_score], [75, 40]);
  });

  test("no cited kitchen info means high risk; a reassuring rating needs good evidence", async () => {
    process.env.OPENAI_API_KEY = "test";
    fakeGemini({ menu, kitchen: { ...kitchen, findings: [{ text: "Uncited.", tone: "good", source_url: "https://elsewhere.example/" }] } });
    fakeWeb((prompt) => (prompt.includes("food menu") ? [{ url: "https://sunnythai.example/menu", title: "Menu" }] : [{ url: "https://fmgf.example/", title: "x" }]));
    const { cookie } = await t.login("Alice");
    const res = await runJob(await t.request("POST", "/api/gluten/restaurant", { cookie, body: { name: "Sunny Thai" } }), cookie);
    assert.equal(res.body.cross_contact.level, "high");
    assert.match(res.body.cross_contact.summary, /assume a shared kitchen/);

    fakeGemini({ menu, kitchen: { ...kitchen, findings: [{ text: "Shared fryer.", tone: "bad", source_url: "https://fmgf.example/" }] } });
    const res2 = await runJob(await t.request("POST", "/api/gluten/restaurant", { cookie, body: { name: "Other Thai" } }), cookie);
    assert.equal(res2.body.cross_contact.level, "moderate");
  });

  test("a menu that's mostly gluten means very high cross-contact", async () => {
    process.env.OPENAI_API_KEY = "test";
    fakeGemini({ chances: { "pad thai": 90, "green curry": 90, "spring rolls": 90, "mango sticky rice": 5 }, menu, kitchen });
    fakeWeb(() => [{ url: "https://findmeglutenfree.example/sunny", title: "FMGF" }, { url: "https://sunnythai.example/menu", title: "Menu" }]);
    const { cookie } = await t.login("Alice");
    const res = await runJob(await t.request("POST", "/api/gluten/restaurant", { cookie, body: { name: "Sunny Thai" } }), cookie);
    assert.equal(res.body.cross_contact.level, "very_high");
    assert.match(res.body.cross_contact.menu_note, /Most of this menu/);
    assert.equal(res.body.score.overall_score, 15);
  });

  test("no menu found: a helpful 404 and no quota used", async () => {
    process.env.OPENAI_API_KEY = "test";
    fakeGemini({ menu, kitchen });
    fakeWeb(() => []);
    const { cookie } = await t.login("Alice");
    const res = await runJob(await t.request("POST", "/api/gluten/restaurant", { cookie, body: { name: "Nowhere Diner", city: "Atlantis" } }), cookie);
    assert.equal(res.status, 404);
    assert.match(res.body.error, /couldn't find a menu for Nowhere Diner in Atlantis/);
    assert.equal((await t.request("GET", `/api/gluten/usage?local_date=${today()}`, { cookie })).body.restaurant.remaining, 3);
  });

  test("a daily limit on new restaurant checks", async () => {
    process.env.OPENAI_API_KEY = "test";
    fakeGemini({ menu, kitchen });
    fakeWeb(() => [{ url: "https://sunnythai.example/menu", title: "Menu" }]);
    const { cookie } = await t.login("Alice");
    for (const name of ["One", "Two", "Three"]) {
      assert.equal((await runJob(await t.request("POST", "/api/gluten/restaurant", { cookie, body: { name } }), cookie)).status, 200);
    }
    const res = await t.request("POST", "/api/gluten/restaurant", { cookie, body: { name: "Four" } });
    assert.equal(res.status, 429);
    assert.match(res.body.error, /3 restaurant checks/);
  });

  test("a pasted link is read without a web search for the menu", async () => {
    restaurants.menuFromUrl = async (link) => ({ name: "Sunny Thai", location: "", menu_url: link, dishes: menu.dishes });
    fakeGemini();
    const { cookie } = await t.login("Alice");
    const res = await runJob(await t.request("POST", "/api/gluten/restaurant", { cookie, body: { url: "https://sunnythai.example/menu" } }), cookie);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.cross_contact.level, "high"); // web search is off, so nothing is known about the kitchen
    assert.equal(calls.web.length, 0);
  });

  test("links to private addresses are refused", async () => {
    fakeGemini();
    const { cookie } = await t.login("Alice");
    assert.equal((await t.request("POST", "/api/gluten/restaurant", { cookie, body: { url: "http://127.0.0.1:8080/menu" } })).status, 422);
    const res = await runJob(await t.request("POST", "/api/gluten/restaurant", { cookie, body: { url: "http://localhost/menu" } }), cookie);
    assert.equal(res.status, 422);
    assert.match(res.body.error, /couldn't open that link/);
  });
});

describe("safe fetching", () => {
  test("private and local addresses are recognized", () => {
    const { isPrivateAddress, parseUrl } = require("../../lib/safeFetch");
    for (const a of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "0.0.0.0"]) {
      assert.equal(isPrivateAddress(a), true, a);
    }
    for (const a of ["8.8.8.8", "151.101.1.1", "2606:4700::1111"]) assert.equal(isPrivateAddress(a), false, a);
    assert.equal(parseUrl("https://user:pw@example.com/"), null);
    assert.equal(parseUrl("https://example.com:2375/"), null);
    assert.equal(parseUrl("file:///etc/passwd"), null);
    assert.ok(parseUrl("https://example.com/menu.pdf"));
  });
});

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);

function wav(seconds) {
  const rate = 16000;
  const data = Buffer.alloc(Math.round(seconds * rate * 2));
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVE", 8);
  header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

describe("menu photo", () => {
  test("reads the photo with Gemini and analyzes the dishes", async () => {
    fakeGemini({ chances: { "caesar salad": 80 }, photo: { readable: true, restaurant_name: "Cafe", dishes: [{ name: "Caesar Salad", description: "Croutons, parmesan" }, { name: "Steak Frites" }] } });
    const { cookie } = await t.login("Alice");
    const res = await runJob(await t.request("POST", `/api/gluten/menu-photo?local_date=${today()}`, { cookie, raw: JPEG, contentType: "image/jpeg" }), cookie);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.dishes[0].verdict, "likely_gluten");
    assert.equal(res.body.score.ingredient_score, 0); // steak frites: no clear answer, so ask
    assert.equal(res.body.score.overall_score, undefined);
    assert.equal(res.body.remaining, 9);
    const sent = calls.gemini.find((c) => c.media && c.media.length);
    assert.equal(sent.media[0].mimeType, "image/jpeg");
  });

  test("rejects what isn't a photo, and unreadable photos don't use the quota", async () => {
    fakeGemini({ photo: { readable: false, dishes: [] } });
    const { cookie } = await t.login("Alice");
    assert.equal((await t.request("POST", "/api/gluten/menu-photo", { cookie, raw: Buffer.from("hello"), contentType: "image/jpeg" })).status, 422);
    assert.equal((await t.request("POST", "/api/gluten/menu-photo", { cookie, body: { photo: "x" } })).status, 422);
    const res = await runJob(await t.request("POST", "/api/gluten/menu-photo", { cookie, raw: JPEG, contentType: "image/jpeg" }), cookie);
    assert.equal(res.status, 422);
    assert.match(res.body.error, /too hard to read/);
    assert.equal(await t.db.AiUsages.count(), 0);
  });
});

describe("waiter voice", () => {
  test("flags gluten the server mentions", async () => {
    fakeGemini({ voice: {
      transcript: "It's marinated in soy sauce and grilled.",
      ingredients: [{ name: "soy sauce", gluten: "gluten_free", reason: "wrong" }, { name: "chicken", gluten: "gluten_free", reason: "" }],
      preparation: [{ text: "Grilled on the shared grill", risk: "cross_contact" }]
    } });
    const { cookie } = await t.login("Alice");
    const res = await t.request("POST", `/api/gluten/voice?local_date=${today()}`, { cookie, raw: wav(3), contentType: "audio/wav" });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.verdict, "likely_gluten");
    // the rules overrule the model
    assert.equal(res.body.ingredients[0].gluten_status, "contains");
    assert.match(res.body.transcript, /soy sauce/);
    assert.equal(res.body.typical, null);
    assert.equal(calls.gemini[0].media[0].mimeType, "audio/wav");
  });

  test("what the server says can't clear a dish that's usually made with gluten", async () => {
    fakeGemini({ chances: { "chicken katsu": 95 }, voice: {
      transcript: "Chicken, rice and cabbage.",
      ingredients: [{ name: "chicken", gluten: "gluten_free", reason: "" }, { name: "rice", gluten: "gluten_free", reason: "" }],
      preparation: []
    } });
    const { cookie } = await t.login("Alice");
    const res = await t.request("POST", "/api/gluten/voice?dish=Chicken%20Katsu", { cookie, raw: wav(2), contentType: "audio/wav" });
    assert.equal(res.body.verdict, "ask");
    assert.match(res.body.reason, /usually made with gluten/);
    assert.equal(res.body.typical.verdict, "likely_gluten");
  });

  test("checks the recording", async () => {
    fakeGemini({ voice: { transcript: "", ingredients: [], preparation: [] } });
    const { cookie } = await t.login("Alice");
    assert.equal((await t.request("POST", "/api/gluten/voice", { cookie, raw: Buffer.from("not audio"), contentType: "audio/wav" })).status, 422);
    assert.equal((await t.request("POST", "/api/gluten/voice", { cookie, raw: wav(70), contentType: "audio/wav" })).status, 422);
    assert.equal((await t.request("POST", "/api/gluten/voice", { cookie, raw: wav(0.1), contentType: "audio/wav" })).status, 422);
    const quiet = await t.request("POST", "/api/gluten/voice", { cookie, raw: wav(2), contentType: "audio/wav" });
    assert.equal(quiet.body.verdict, "unknown");
    assert.match(quiet.body.reason, /didn't catch any ingredients/);
  });

  test("usage shows what's left of each check", async () => {
    const { cookie } = await t.login("Alice");
    const res = await t.request("GET", `/api/gluten/usage?local_date=${today()}`, { cookie });
    assert.deepEqual(res.body, {
      restaurant: { limit: 3, remaining: 3 }, menu: { limit: 10, remaining: 10 }, voice: { limit: 20, remaining: 20 }, restaurant_by_name: false
    });
  });
});
