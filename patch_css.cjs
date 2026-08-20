const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');
const keyframes = `
@keyframes drift{from{transform:translateX(-14%)}to{transform:translateX(114%)}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes sway{0%,100%{transform:rotate(-1.2deg)}50%{transform:rotate(1.2deg)}}
@keyframes sunPulse{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:.85;transform:scale(1.06)}}
@keyframes twinkle{0%,100%{opacity:.15}50%{opacity:.95}}
@keyframes rainfall{from{transform:translateY(-60px)}to{transform:translateY(660px)}}
@keyframes snowfall{from{transform:translate(0,-40px)}to{transform:translate(28px,650px)}}
@keyframes walkin{from{transform:translateX(180px)}to{transform:translateX(0)}}
@keyframes wipe{0%,18%{transform:rotate(0deg)}32%,52%{transform:rotate(-104deg)}68%,100%{transform:rotate(0deg)}}
@keyframes shade{0%,100%{transform:rotate(-96deg)}50%{transform:rotate(-84deg)}}
@keyframes hug{0%,100%{transform:rotate(-48deg)}50%{transform:rotate(-56deg)}}
@keyframes shiver{0%,100%{transform:translateX(0)}25%{transform:translateX(-1.2px)}75%{transform:translateX(1.2px)}}
@keyframes breathe{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}
@keyframes birdfly{from{transform:translate(-40px,20px)}to{transform:translate(1300px,-40px)}}
@keyframes draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes wave{0%,100%{transform:translateX(0)}50%{transform:translateX(-18px)}}
@keyframes grasswave{0%,100%{transform:skewX(-1.4deg)}50%{transform:skewX(1.4deg)}}
`;
if (!css.includes('keyframes drift')) {
  fs.writeFileSync('src/index.css', css + keyframes);
}
