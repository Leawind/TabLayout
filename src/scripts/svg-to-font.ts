import { svg2Font } from 'csvg-to-font';

const START_CODE = 0xE000;
const FONT_NAME = 'icons';

let map = new Map<number, string>();

function getIconUnicode(name: string): [string, number] {
	let code: number;

	const match = /^(0x[0-9A-F]+)([^0-9A-F].*)?$/i.exec(name);
	if (match !== null) {
		code = parseInt(match[1]);
		if (map.has(code)) {
			throw new Error(`Code ${code} already exists`);
		}
	} else {
		code = START_CODE;
		while (map.has(code)) {
			code++;
		}
	}
	map.set(code, name);

	console.log(`0x${code.toString(16)} ==> ${name}`);
	return [String.fromCharCode(code), code];
};

svg2Font({
	src: 'resources/icons',
	dist: 'resources/fonts',

	fontName: FONT_NAME,
	svgicons2svgfont: {
		fontName: FONT_NAME,
		normalize: true,
	},
	log: true,

	css: false,
	outSVGReact: false,
	outSVGReactNative: false,
	outSVGPath: false,
	generateInfoData: false,
	emptyDist: true,
	typescript: false,

	getIconUnicode,

});

console.log('Done');
