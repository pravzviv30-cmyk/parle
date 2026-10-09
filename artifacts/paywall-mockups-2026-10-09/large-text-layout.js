// Applied only to accessibility fixtures; ordinary screens retain shared instances.
// Load the fixture's fonts before calling. Keep text at the requested scale.
function largeTextLayout(root, createdNodeIds, mutatedNodeIds, removedNodeIds) {
  const touched = new Set();
  const touch = n => { if (n) touched.add(n.id); };
  const fillText = t => {
    t.layoutSizingHorizontal = 'FILL';
    t.textAutoResize = 'HEIGHT';
    t.textAlignHorizontal = 'LEFT';
    touch(t);
  };
  const hero = root.findOne(n => n.name === 'French speaking');
  if (hero) {
    hero.layoutMode = 'VERTICAL';
    hero.layoutSizingVertical = 'HUG';
    hero.clipsContent = false;
    touch(hero);
    for (const c of hero.children) {
      if (c.type === 'TEXT') fillText(c);
      else { c.visible = false; touch(c); } // Decorative illustration yields to text.
    }
  }
  const more = root.findOne(n => n.type === 'FRAME' && n.name === 'More time');
  if (more) {
    more.resize(144, 44);
    more.minHeight = 44;
    more.layoutSizingVertical = 'HUG';
    touch(more);
    for (const t of more.children) if (t.type === 'TEXT') fillText(t);
  }
  const nav = root.findOne(n => n.name === 'Navigation');
  if (nav) { nav.minHeight = 44; nav.layoutSizingVertical = 'HUG'; touch(nav); }
  for (const offer of root.findAll(n => n.type === 'INSTANCE' && n.name === 'Paywall/Offer row')) {
    removedNodeIds.push(offer.id, ...offer.findAll(() => true).map(n => n.id));
    const card = offer.detachInstance();
    createdNodeIds.push(card.id, ...card.findAll(() => true).map(n => n.id));
    card.counterAxisAlignItems = 'MIN';
    card.layoutSizingVertical = 'HUG';
    card.minHeight = 84;
    touch(card);
    for (const row of card.findAll(n => n.type === 'FRAME' && ['Plan and billed total', 'Allowance and saving'].includes(n.name))) {
      row.layoutMode = 'VERTICAL';
      row.itemSpacing = 4;
      row.layoutSizingHorizontal = 'FILL';
      row.layoutSizingVertical = 'HUG';
      touch(row);
      for (const t of row.children) if (t.type === 'TEXT') {
        fillText(t);
        if (!t.characters.trim()) { t.visible = false; touch(t); }
      }
    }
  }
  const timeline = root.findOne(n => n.name === 'Seven-day trial');
  if (timeline) for (const row of timeline.children) {
    row.layoutMode = 'VERTICAL'; row.itemSpacing = 4; touch(row);
    for (const t of row.children) if (t.type === 'TEXT') fillText(t);
  }
  const legal = root.findOne(n => n.name === 'Recovery and legal');
  if (legal) {
    legal.layoutWrap = 'WRAP';
    legal.itemSpacing = 12;
    legal.counterAxisSpacing = 8;
    touch(legal);
    for (const hit of legal.children) {
      hit.resize((legal.width - 12) / 2, 44);
      hit.layoutSizingHorizontal = 'FIXED';
      hit.layoutSizingVertical = 'HUG';
      hit.minHeight = 44; touch(hit);
      for (const t of hit.children) if (t.type === 'TEXT') fillText(t);
    }
  }
  const stats = root.findOne(n => n.name === 'Your progress');
  if (stats) {
    stats.layoutMode = 'VERTICAL';
    stats.layoutSizingVertical = 'HUG';
    touch(stats);
    for (const card of stats.children) {
      card.layoutSizingHorizontal = 'FILL';
      card.layoutSizingVertical = 'HUG'; touch(card);
      for (const t of card.children) if (t.type === 'TEXT') fillText(t);
    }
  }
  mutatedNodeIds.push(...touched);
}
