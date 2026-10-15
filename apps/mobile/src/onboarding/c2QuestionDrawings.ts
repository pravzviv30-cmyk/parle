import type { C2QuestionPage } from './c2QuestionScenes.ts';

type QuestionPalette = {
  ink: string; white: string; paper: string; violet: string; sun: string;
  peach: string; sage: string; lavender: string; butter: string; coral: string;
};

export type C2QuestionGesture = {
  readonly pivot: readonly [number, number];
  readonly rotate?: number;
  readonly lift?: number;
  readonly scale?: number;
  readonly phaseOffset?: number;
};

export type C2QuestionDrawingPart = {
  readonly id: string;
  readonly xml: string;
  readonly gesture?: C2QuestionGesture;
};

type DrawingPart = {
  id: string;
  body: string;
  gesture?: C2QuestionGesture;
};

function drawing(id: string, body: string): string {
  return `<svg id="question-${id}" xmlns="http://www.w3.org/2000/svg" width="280" height="180" viewBox="0 0 280 180"><g stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
}

function part(id: string, body: string, gesture?: C2QuestionGesture): DrawingPart {
  return { id, body, ...(gesture ? { gesture } : {}) };
}

/** Shared joint definitions retain attachment across separate rear/front paint planes. */
function questionDrawingParts(c: QuestionPalette): Record<C2QuestionPage, readonly DrawingPart[]> {
  const clockCup: C2QuestionGesture = { pivot: [188, 96], rotate: -2 };
  const clockSteam: C2QuestionGesture = { ...clockCup, lift: -1.2 };
  const mapOffer: C2QuestionGesture = { pivot: [210, 92], rotate: -2.5 };
  const bookLeft: C2QuestionGesture = { pivot: [64, 98], rotate: 3 };
  const bookRight: C2QuestionGesture = { pivot: [217, 99], rotate: -3 };
  const leaves: C2QuestionGesture = { pivot: [140, 96], rotate: 2 };
  const watering: C2QuestionGesture = { pivot: [178, 111], rotate: -1.5 };
  const confidenceLeft: C2QuestionGesture = { pivot: [69, 86], rotate: 3 };
  const confidenceRight: C2QuestionGesture = { pivot: [215, 91], rotate: -3 };
  const soundBadge: C2QuestionGesture = { pivot: [213, 41], scale: 0.012 };
  const listenerLean: C2QuestionGesture = { pivot: [112, 102], rotate: 1 };
  const speakerLean: C2QuestionGesture = { pivot: [163, 115], rotate: -1 };
  return {
    time: [
      part('clock', `
        <ellipse cx="141" cy="157" rx="77" ry="5" fill="${c.ink}" opacity="0.07"/>
        <path d="M101 128C102 138 98 145 91 150M163 130C163 140 171 147 181 148" fill="none" stroke="${c.ink}" stroke-width="4.5"/>
        <path d="M84 150C88 145 99 146 104 152C102 157 89 158 84 154ZM169 151C169 146 181 144 188 149C189 154 176 157 169 155Z" fill="${c.ink}"/>
        <path d="M71 87C61 92 53 102 57 114C59 119 65 123 72 121" fill="none" stroke="${c.ink}" stroke-width="4.5"/>
        <path d="M58 112C55 108 50 107 46 111C43 115 46 122 52 122L61 121" fill="${c.sun}"/>
        <path d="M136 20C177 18 199 42 200 78C202 114 177 138 140 141C100 144 79 120 78 83C76 44 99 22 136 20Z" fill="${c.peach}"/>
        <path d="M126 18C161 16 188 36 190 72C192 107 173 134 136 136C99 139 72 117 71 80C70 46 91 22 126 18Z" fill="${c.sun}"/>
        <path d="M134 28C161 29 180 48 180 76C180 104 159 125 132 126C104 127 83 106 83 80C82 49 104 28 134 28Z" fill="${c.paper}"/>
        <path d="M95 54C101 42 113 35 127 34" fill="none" stroke="${c.white}" stroke-width="4.5"/>
        <path d="M130 44L132 73L155 86" fill="none" stroke="${c.ink}" stroke-width="4.5"/>
        <circle cx="132" cy="73" r="4.5" fill="${c.coral}"/>
        <path d="M109 92Q113 97 117 92M142 92Q146 97 150 92M122 107Q130 115 139 106" fill="none" stroke="${c.ink}" stroke-width="3.5"/>
        <ellipse cx="103" cy="103" rx="6" ry="3.5" fill="${c.peach}"/>
        <ellipse cx="158" cy="103" rx="6" ry="3.5" fill="${c.peach}"/>
      `),
      part('cup-arm', `
        <path d="M188 96C197 107 204 118 215 115" fill="none" stroke="${c.ink}" stroke-width="4.5"/>
        <path d="M233 98L242 98C254 98 254 115 241 117L233 116" fill="none" stroke="${c.violet}" stroke-width="4.5"/>
        <path d="M211 96L237 96L236 117C234 129 214 129 211 117Z" fill="${c.violet}"/>
        <path d="M214 98L218 98L218 116C219 120 221 122 224 123" fill="none" stroke="${c.lavender}" stroke-width="3.5"/>
      `, clockCup),
      part('cup-steam', `
        <path d="M221 85C217 80 225 77 221 72M232 86C229 82 234 80 232 76" fill="none" stroke="${c.ink}" stroke-width="3.5"/>
      `, clockSteam),
      part('accents', `
        <path d="M35 43C44 42 46 39 47 31C48 39 51 42 59 43C51 44 48 47 47 55C46 47 44 44 35 43Z" fill="${c.violet}"/>
        <circle cx="217" cy="37" r="4" fill="${c.peach}"/>
        <path d="M235 28L238 24M244 37L250 36" fill="none" stroke="${c.sun}" stroke-width="3.5"/>
      `),
    ],
    reason: [
      part('foundation', `
        <ellipse cx="139" cy="157" rx="81" ry="5" fill="${c.ink}" opacity="0.07"/>
        <path d="M100 132C100 141 95 147 91 151M170 130C174 139 181 145 182 151" fill="none" stroke="${c.ink}" stroke-width="4.5"/>
        <path d="M84 151C87 146 100 146 105 152C101 158 89 158 84 154ZM175 151C180 145 190 146 194 152C194 158 181 158 175 154Z" fill="${c.ink}"/>
      `),
      part('resting-arm', `
        <path d="M72 103C59 112 48 111 44 99L43 90" fill="none" stroke="${c.ink}" stroke-width="4.5"/>
      `),
      part('compass-arm', `
        <path d="M210 92C222 94 233 85 234 73" fill="none" stroke="${c.ink}" stroke-width="4.5"/>
      `, mapOffer),
      part('resting-hand', `
        <path d="M38 88C39 82 48 81 51 86C53 91 48 98 43 97C38 96 36 92 38 88Z" fill="${c.peach}"/>
      `),
      part('map', `
        <path d="M72 36C71 30 76 28 83 30L114 43L159 29L205 45C210 47 213 52 213 58L212 130C212 138 207 141 201 139L160 126L118 141L72 125C68 123 67 120 67 114Z" fill="${c.violet}"/>
        <path d="M77 30C77 25 81 24 87 27L117 39L161 25L200 40C205 42 208 46 208 51L207 122C207 130 202 133 196 131L160 118L118 133L78 119C73 117 72 114 72 108Z" fill="${c.paper}"/>
        <path d="M78 29L117 43L118 129L79 115C77 114 77 111 77 107Z" fill="${c.sage}"/>
        <path d="M160 29L201 45L201 125L160 112Z" fill="${c.butter}"/>
        <path d="M117 43L118 129M160 30L160 112" fill="none" stroke="${c.ink}" stroke-width="3.5" opacity="0.13"/>
        <path d="M89 104C101 98 100 87 89 84C77 80 86 65 104 67" fill="none" stroke="${c.violet}" stroke-width="3.5"/>
        <circle cx="89" cy="105" r="4.5" fill="${c.violet}"/>
        <path d="M99 57C99 52 103 49 108 49C113 49 116 52 116 57C116 62 108 70 108 70C108 70 99 62 99 57Z" fill="${c.coral}"/>
        <circle cx="108" cy="57" r="3" fill="${c.paper}"/>
        <path d="M128 78Q132 73 136 78M145 77Q149 72 153 77M134 93Q142 101 151 92" fill="none" stroke="${c.ink}" stroke-width="3.5"/>
        <ellipse cx="126" cy="89" rx="5" ry="3" fill="${c.peach}"/>
        <ellipse cx="156" cy="88" rx="5" ry="3" fill="${c.peach}"/>
        <path d="M178 88C184 84 190 86 194 92M177 99L191 104" fill="none" stroke="${c.sun}" stroke-width="3.5"/>
      `),
      part('compass', `
        <circle cx="231" cy="54" r="20" fill="${c.sun}"/>
        <circle cx="231" cy="54" r="15" fill="${c.paper}"/>
        <path d="M230 41L237 55L223 67L226 52Z" fill="${c.violet}"/>
        <path d="M230 41L237 55L226 52Z" fill="${c.coral}"/>
        <circle cx="230" cy="54" r="2.5" fill="${c.ink}"/>
      `, mapOffer),
      part('accents', `
        <path d="M39 44C45 43 47 41 48 35C49 41 51 43 57 44C51 45 49 47 48 53C47 47 45 45 39 44Z" fill="${c.sun}"/>
        <path d="M231 24L233 18M250 30L254 26" fill="none" stroke="${c.violet}" stroke-width="3.5"/>
      `),
    ],
    interests: [
      part('foundation', `
        <ellipse cx="140" cy="157" rx="82" ry="5" fill="${c.ink}" opacity="0.07"/>
        <path d="M94 132C94 142 87 147 87 152M178 134C181 142 188 146 190 152" fill="none" stroke="${c.ink}" stroke-width="4.5"/>
        <path d="M79 152C84 146 94 146 100 152C98 158 85 158 79 155ZM181 153C183 147 196 146 201 152C200 158 188 158 181 155Z" fill="${c.ink}"/>
      `),
      part('left-welcome-arm', `
        <path d="M64 98C53 112 41 111 38 99" fill="none" stroke="${c.ink}" stroke-width="4.5"/>
      `, bookLeft),
      part('right-welcome-hand', `
        <path d="M217 99C228 101 239 95 243 85" fill="none" stroke="${c.ink}" stroke-width="4.5"/>
        <path d="M238 83C239 77 248 76 251 80C255 85 251 92 245 92C240 92 236 89 238 83Z" fill="${c.sun}"/>
      `, bookRight),
      part('book', `
        <path d="M64 42C83 38 114 43 138 61C160 43 190 39 214 44C219 45 222 49 222 56L222 132C222 138 218 141 212 140C181 134 160 139 139 148C118 139 96 135 65 140C59 140 55 137 55 131L55 54C55 47 58 43 64 42Z" fill="${c.violet}"/>
        <path d="M68 35C94 33 118 41 139 56C158 42 184 33 209 36C214 37 216 41 216 47L216 121C216 127 213 130 207 129C181 127 160 131 139 141C117 130 96 126 70 128C64 129 61 126 61 120L61 47C61 40 63 36 68 35Z" fill="${c.paper}"/>
        <path d="M69 41C91 39 118 46 137 59L137 135C116 125 97 119 69 122Z" fill="${c.butter}"/>
        <path d="M141 59C164 43 184 40 207 41L207 122C182 120 164 125 141 135Z" fill="${c.lavender}"/>
        <path d="M139 58L139 135" fill="none" stroke="${c.ink}" stroke-width="3.5" opacity="0.15"/>
        <path d="M88 54Q104 55 118 62M88 63Q97 64 106 68M163 57Q180 50 193 50" fill="none" stroke="${c.violet}" stroke-width="3.5" opacity="0.23"/>
        <path d="M110 82Q114 87 118 82M160 82Q164 87 168 82" fill="none" stroke="${c.ink}" stroke-width="3.5"/>
        <path d="M128 101Q140 113 152 101" fill="none" stroke="${c.ink}" stroke-width="3.5"/>
        <ellipse cx="105" cy="95" rx="7" ry="4" fill="${c.peach}"/>
        <ellipse cx="173" cy="95" rx="7" ry="4" fill="${c.peach}"/>
        <path d="M177 38L189 37L190 61L184 56L178 63Z" fill="${c.coral}"/>
      `),
      part('curiosity-badge', `
        <circle cx="232" cy="39" r="19" fill="${c.sun}"/>
        <path d="M220 39C228 38 230 36 232 27C234 36 236 38 244 39C236 41 234 43 232 51C230 43 228 41 220 39Z" fill="${c.violet}"/>
      `),
      part('accents', `
        <path d="M43 40L40 35M49 26L50 20" fill="none" stroke="${c.violet}" stroke-width="3.5"/>
        <circle cx="33" cy="62" r="4" fill="${c.peach}"/>
      `),
    ],
    'start-level': [
      part('foundation', `
        <ellipse cx="144" cy="157" rx="72" ry="5" fill="${c.ink}" opacity="0.07"/>
        <path d="M122 133C119 143 112 148 112 153M164 135C167 143 174 146 177 153" fill="none" stroke="${c.ink}" stroke-width="4.5"/>
        <path d="M104 152C109 147 120 147 125 153C121 158 109 158 104 155ZM170 153C173 148 184 147 190 151C190 157 176 159 170 156Z" fill="${c.ink}"/>
      `),
      part('growing-leaves', `
        <path d="M140 96C137 66 138 44 149 25" fill="none" stroke="${c.ink}" stroke-width="4.5"/>
        <path d="M138 66C113 67 78 47 70 22C98 11 130 27 142 59C144 63 143 66 138 66Z" fill="${c.paper}"/>
        <path d="M141 68C166 76 199 59 211 31C185 19 155 34 141 58C138 63 137 67 141 68Z" fill="${c.violet}"/>
        <path d="M141 48C146 29 163 16 181 17C182 35 169 52 148 59Z" fill="${c.sun}"/>
        <path d="M85 29Q112 35 135 59M199 38Q172 44 148 64" fill="none" stroke="${c.ink}" stroke-width="3.5" opacity="0.25"/>
      `, leaves),
      part('plant', `
        <path d="M103 95C104 85 116 81 137 83L173 83C182 84 185 91 183 100L178 130C176 140 166 144 149 145L124 143C111 141 106 135 105 123Z" fill="${c.violet}"/>
        <path d="M99 89C100 80 111 76 131 78L167 79C177 80 180 86 178 96L173 126C171 136 161 140 144 141L121 139C108 137 103 131 102 119Z" fill="${c.peach}"/>
        <path d="M106 87Q135 82 169 87" fill="none" stroke="${c.paper}" stroke-width="4.5" opacity="0.65"/>
        <path d="M121 104Q125 99 129 104M145 104Q149 99 153 104M130 117Q138 126 147 117" fill="none" stroke="${c.ink}" stroke-width="3.5"/>
        <ellipse cx="117" cy="115" rx="5" ry="3" fill="${c.coral}" opacity="0.23"/>
        <ellipse cx="156" cy="115" rx="5" ry="3" fill="${c.coral}" opacity="0.23"/>
      `),
      part('resting-arm', `
        <path d="M105 105C93 105 89 96 86 86" fill="none" stroke="${c.ink}" stroke-width="4.5"/>
      `),
      part('watering-arm', `
        <path d="M178 111C191 110 194 98 201 95" fill="none" stroke="${c.ink}" stroke-width="4.5"/>
      `, watering),
      part('resting-hand', `
        <path d="M81 83C82 77 91 77 94 82C97 88 91 93 86 92C80 91 78 87 81 83Z" fill="${c.peach}"/>
      `),
      part('watering-can', `
        <path d="M202 81C198 70 219 69 222 83" fill="none" stroke="${c.violet}" stroke-width="4.5"/>
        <path d="M196 81L225 81L228 104C225 115 199 114 196 104Z" fill="${c.sun}"/>
        <path d="M225 86L243 78L248 84L227 99Z" fill="${c.sun}"/>
        <path d="M199 86L202 101C203 105 207 107 212 107" fill="none" stroke="${c.butter}" stroke-width="3.5"/>
        <path d="M247 94L248 98M256 90L258 94" fill="none" stroke="${c.violet}" stroke-width="3.5"/>
      `, watering),
      part('accents', `
        <path d="M44 63C50 62 52 60 53 54C54 60 56 62 62 63C56 64 54 66 53 72C52 66 50 64 44 63Z" fill="${c.sun}"/>
        <circle cx="229" cy="29" r="4" fill="${c.peach}"/>
      `),
    ],
    confidence: [
      part('foundation', `
        <ellipse cx="140" cy="157" rx="77" ry="5" fill="${c.ink}" opacity="0.07"/>
        <path d="M103 121C106 132 98 144 93 151M178 124C178 137 184 145 190 150" fill="none" stroke="${c.ink}" stroke-width="4.5"/>
        <path d="M86 151C90 146 102 146 107 152C104 158 91 158 86 155ZM183 151C189 145 199 146 204 152C201 158 189 158 183 155Z" fill="${c.ink}"/>
      `),
      part('left-open-arm', `
        <path d="M69 86C56 85 47 78 44 68" fill="none" stroke="${c.ink}" stroke-width="4.5"/>
      `, confidenceLeft),
      part('right-open-arm', `
        <path d="M215 91C229 89 238 80 241 68" fill="none" stroke="${c.ink}" stroke-width="4.5"/>
      `, confidenceRight),
      part('left-open-hand', `
        <path d="M36 62C40 56 49 57 51 63C54 70 48 75 42 73C36 72 33 67 36 62Z" fill="${c.peach}"/>
      `, confidenceLeft),
      part('right-open-hand', `
        <path d="M234 64C235 58 244 56 249 60C254 65 252 72 247 75C242 77 235 72 234 64Z" fill="${c.peach}"/>
      `, confidenceRight),
      part('speech', `
        <path d="M103 29C111 18 129 15 149 21C168 15 191 21 204 35C223 38 232 57 228 76C237 96 226 113 208 122C192 134 165 134 149 132L132 145C125 149 121 146 122 140L123 130C99 133 79 129 69 115C51 104 49 83 58 66C54 49 72 32 90 34C94 32 99 30 103 29Z" fill="${c.sun}"/>
        <path d="M98 24C109 14 128 15 144 20C165 13 184 20 197 32C216 35 223 51 220 69C229 90 216 108 198 115C181 126 159 125 141 123L124 137C118 141 114 139 115 133L116 123C93 126 74 121 64 107C48 96 50 78 59 61C56 45 72 28 90 29Z" fill="${c.peach}"/>
        <path d="M84 36C95 29 105 30 111 31" fill="none" stroke="${c.paper}" stroke-width="4.5"/>
        <path d="M108 72Q114 65 120 72M149 72Q155 65 161 72" fill="none" stroke="${c.ink}" stroke-width="3.5"/>
        <path d="M123 90Q134 104 147 89" fill="none" stroke="${c.ink}" stroke-width="3.5"/>
        <ellipse cx="102" cy="87" rx="8" ry="4.5" fill="${c.coral}" opacity="0.2"/>
        <ellipse cx="166" cy="87" rx="8" ry="4.5" fill="${c.coral}" opacity="0.2"/>
      `),
      part('sound-badge', `
        <circle cx="213" cy="41" r="24" fill="${c.violet}"/>
        <path d="M202 37L207 37L214 31L214 51L207 45L202 45Z" fill="${c.sun}"/>
        <path d="M220 36Q225 41 220 46M226 31Q236 41 226 51" fill="none" stroke="${c.sun}" stroke-width="3.5"/>
      `, soundBadge),
      part('accents', `
        <path d="M34 99L29 103M44 113L43 119M246 107L251 111" fill="none" stroke="${c.violet}" stroke-width="3.5"/>
      `),
    ],
    focus: [
      part('foundation', `
        <ellipse cx="143" cy="157" rx="94" ry="5" fill="${c.ink}" opacity="0.07"/>
        <path d="M72 116C72 133 67 144 64 151M104 116C106 131 111 143 116 151M179 126C175 138 177 147 177 152M214 127C217 139 224 145 229 151" fill="none" stroke="${c.ink}" stroke-width="4.5"/>
        <path d="M57 151C60 146 70 146 76 151C75 157 62 158 57 155ZM108 152C112 146 123 147 128 153C124 158 113 158 108 155ZM170 153C172 148 183 147 189 152C188 158 176 158 170 156ZM221 152C225 146 236 147 241 153C237 158 225 158 221 155Z" fill="${c.ink}"/>
      `),
      part('listening-partner', `
        <path d="M40 42C37 26 51 16 68 20L105 26C124 29 137 42 135 61L131 91C130 109 117 119 98 117L85 117L66 127C60 130 57 127 59 122L62 112C43 108 34 94 36 78Z" fill="${c.ink}"/>
        <path d="M35 35C33 19 47 12 65 16L102 22C122 25 131 38 129 56L125 85C123 103 111 113 93 111L81 111L63 120C57 123 54 120 56 115L58 106C40 102 29 90 31 73Z" fill="${c.violet}"/>
        <path d="M45 30Q51 25 63 29" fill="none" stroke="${c.lavender}" stroke-width="4.5"/>
        <path d="M74 61Q78 57 82 61M100 62Q104 58 108 62M85 78Q94 87 104 79" fill="none" stroke="${c.white}" stroke-width="3.5"/>
        <ellipse cx="70" cy="73" rx="6" ry="3.5" fill="${c.peach}"/>
        <ellipse cx="112" cy="74" rx="5" ry="3.5" fill="${c.peach}"/>
      `, listenerLean),
      part('speaking-partner', `
        <path d="M167 43C180 30 204 34 218 40C240 40 253 54 252 74L253 104C253 124 238 138 217 136L188 134C170 134 156 126 156 111L152 91L143 79C138 73 140 69 146 70L154 72C153 60 157 50 167 43Z" fill="${c.peach}"/>
        <path d="M161 38C174 25 198 29 212 35C235 35 247 50 246 69L247 99C247 119 232 132 211 130L182 128C164 128 151 120 151 105L147 85L138 73C134 67 136 63 142 64L150 66C149 55 151 45 161 38Z" fill="${c.sun}"/>
        <path d="M172 41Q188 35 200 40" fill="none" stroke="${c.butter}" stroke-width="4.5"/>
        <path d="M170 76Q174 71 178 75M195 74Q199 69 203 73M177 90Q186 99 196 89" fill="none" stroke="${c.ink}" stroke-width="3.5"/>
        <ellipse cx="166" cy="88" rx="6" ry="3.5" fill="${c.peach}"/>
        <ellipse cx="210" cy="84" rx="6" ry="3.5" fill="${c.peach}"/>
      `, speakerLean),
      part('shared-clasp', `
        <path d="M112 102C119 115 132 117 140 111M163 115C154 122 144 120 140 111" fill="none" stroke="${c.ink}" stroke-width="4.5"/>
        <path d="M134 108C138 103 145 104 148 109C150 115 145 120 140 118C134 117 132 113 134 108Z" fill="${c.peach}"/>
      `),
      part('accent', `
        <path d="M242 23C248 22 250 20 251 14C252 20 254 22 260 23C254 24 252 26 251 32C250 26 248 24 242 23Z" fill="${c.violet}"/>
      `),
    ],
  };
}

function mapQuestionParts<T>(
  parts: Record<C2QuestionPage, readonly DrawingPart[]>,
  create: (page: C2QuestionPage, layers: readonly DrawingPart[]) => T,
): Record<C2QuestionPage, T> {
  return {
    time: create('time', parts.time),
    reason: create('reason', parts.reason),
    interests: create('interests', parts.interests),
    'start-level': create('start-level', parts['start-level']),
    confidence: create('confidence', parts.confidence),
    focus: create('focus', parts.focus),
  };
}

/** Exact Rest composition for still proofs and reduced-motion presentation. */
export function createC2QuestionDrawings(c: QuestionPalette): Record<C2QuestionPage, string> {
  return mapQuestionParts(questionDrawingParts(c), (page, layers) =>
    drawing(page, layers.map(layer => layer.body).join('')),
  );
}

/** Rigid semantic layers; one shared scene clock animates joints without changing their paint order. */
export function createC2QuestionGestureDrawings(c: QuestionPalette): Record<C2QuestionPage, readonly C2QuestionDrawingPart[]> {
  return mapQuestionParts(questionDrawingParts(c), (page, layers) =>
    layers.map(layer => ({
      id: layer.id,
      xml: drawing(`${page}-${layer.id}`, layer.body),
      ...(layer.gesture ? { gesture: layer.gesture } : {}),
    })),
  );
}
