// Character faces as generated SVG data URIs. Lifted from the Claude Design handoff (faceURI).
// Body in accent, features in card colour, optional worried variant with alert badge. Themes recolour automatically.
window.CHARACTERS = { sun: "Sun", cat: "Cat", robot: "Robot", cloud: "Cloud", coffee: "Coffee" };
window.faceURI = function faceURI(id = "sun", worried = false, a = "#d1620a", c = "#ffffff", al = "#c0341d", skin = "") {
  if (!(id in CHARACTERS)) id = "sun";
  const fy = { sun: 55, cat: 58, cloud: 66, coffee: 62, robot: 57 }[id];
  const body = {
    sun: `<g stroke="${a}" stroke-width="3.4" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map((r) => `<line x1="55" y1="12" x2="55" y2="21" transform="rotate(${r} 55 55)"/>`).join("")}</g><circle cx="55" cy="55" r="28" fill="${a}"/>`,
    cat: `<path d="M29 48 L33 16 L54 34 Z" fill="${a}"/><path d="M81 48 L77 16 L56 34 Z" fill="${a}"/><ellipse cx="55" cy="60" rx="30" ry="27" fill="${a}"/><path d="M51.5 63 L58.5 63 L55 67 Z" fill="${c}"/>`,
    robot: `<line x1="55" y1="12" x2="55" y2="26" stroke="${a}" stroke-width="3" stroke-linecap="round"/><circle cx="55" cy="10" r="4.5" fill="${a}"/><rect x="24" y="26" width="62" height="58" rx="14" fill="${a}"/>`,
    cloud: `<path d="M28 84 C12 84 10 62 25 58 C23 41 44 33 54 44 C61 29 86 32 87 51 C102 53 101 84 84 84 Z" fill="${a}"/>`,
    coffee: `<path d="M84 52 a12 12 0 0 1 0 24" fill="none" stroke="${a}" stroke-width="6"/><path d="M26 38 h58 l-6 48 a8 8 0 0 1 -8 7 h-30 a8 8 0 0 1 -8 -7 Z" fill="${a}"/>`,
  }[id];
  let face;
  if (id === "robot") face = `<rect x="38" y="47" width="12" height="9" rx="2.5" fill="${c}"/><rect x="60" y="47" width="12" height="9" rx="2.5" fill="${c}"/>` + (worried ? `<path d="M41 71 l5 -3 l5 3 l5 -3 l5 3 l5 -3" stroke="${c}" stroke-width="2.4" stroke-linecap="round" fill="none"/>` : `<path d="M42 66 Q55 75 68 66" stroke="${c}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`);
  else face = `<circle cx="46.5" cy="${fy - 3}" r="3.1" fill="${c}"/><circle cx="63.5" cy="${fy - 3}" r="3.1" fill="${c}"/>` + (worried
    ? `<g stroke="${c}" stroke-width="2.6" stroke-linecap="round" fill="none"><line x1="41.5" y1="${fy - 13}" x2="50" y2="${fy - 9.5}"/><line x1="68.5" y1="${fy - 13}" x2="60" y2="${fy - 9.5}"/><path d="M46 ${fy + 12} Q55 ${fy + 6.5} 64 ${fy + 12}"/></g>`
    : `<path d="M46 ${fy + 8} Q55 ${fy + 16} 64 ${fy + 8}" stroke="${c}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`);
  const top = { sun: 27, cat: 34, robot: 26, cloud: 38, coffee: 38 }[id];
  const acc = skin === "autumn" ? `<path d="M31 ${fy + 19} Q55 ${fy + 29} 79 ${fy + 19} L79 ${fy + 26} Q55 ${fy + 36} 31 ${fy + 26} Z" fill="${al}"/><rect x="62" y="${fy + 25}" width="8" height="15" rx="3" fill="${al}"/>`
    : skin === "winter" ? `<path d="M34 ${top + 5} Q55 ${top - 26} 76 ${top + 5} Z" fill="${al}"/><rect x="31" y="${top}" width="48" height="8" rx="4" fill="#fff"/><circle cx="55" cy="${top - 19}" r="5.5" fill="#fff"/>`
    : skin === "spring" ? `<g fill="#fff">${[0, 72, 144, 216, 288].map((r) => `<circle cx="81" cy="${top - 2}" r="5" transform="rotate(${r} 81 ${top + 4})"/>`).join("")}</g><circle cx="81" cy="${top + 4}" r="3.5" fill="${al}"/>` : "";
  const badge = worried ? `<circle cx="89" cy="23" r="10" fill="${al}"/><line x1="89" y1="18" x2="89" y2="24.5" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="89" cy="28.5" r="1.5" fill="#fff"/>` : "";
  return "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 110">${body}${face}${acc}${badge}</svg>`);
};
