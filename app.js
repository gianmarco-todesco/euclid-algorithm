"use strict";

if(!window["GCD"]) window["GCD"] = "GCD"; 

function gcd(a,b) {
    while(b>0) [a,b] = [b,a%b];
    return a;
}

// compute pos + dir * amount
function disp(pos, dir, amount) {
    return {x: pos.x + dir.x * amount, y: pos.y + dir.y * amount }
}

// compute 3 square placements
function computeSquarePositions(pos, dir, index, squareSize, mrg1, mrg2, moveFirst) {
    let s = [index*squareSize];
    if(moveFirst) {
        s.push(s[0] + (index+1) * mrg1);
        s.push(s[1] + mrg2);        
    } else {
        s.push(s[0] + index * mrg1);
        s.push(s[1] + (index==0 ? 0 : mrg2));        
    }
    return s.map(amount => disp(pos, dir, amount));
}

// move the square to one of the three percomputed positions
function moveSquare(square, posIndex, duration = 400, delay = 0) {
    let srcPos = {x:square.transform().translateX, y:square.transform().translateY};
    let dstPos = square.positions[posIndex];
    let dx = dstPos.x - srcPos.x;
    let dy = dstPos.y - srcPos.y;
    return square.animate(duration, delay).translate(dx,dy);
}

//
// Un item rappresenta un rettangolo di lati a e b. Interamente è diviso in un certo numero di quadrati (grandi min(a,b)) e 
// un eventuale figlio grande (a%b, b) o (a,b%a)
//
// - a e b sono i numeri impostati dall'utente. Le grandezze in pixel vengono calcolate nel Viewer
// - il rettangolo è delimitato da un bordo (visibile solo quando i pezzi sono attaccati)
class Item {
    constructor(a,b) {
        this.a = a;
        this.b = b;
        this.squares = [];
        this.child = null;
        this.border = null;
        this.maxSize = {lx:0, ly:0}
        this.state = 0;
    }

    // distrugge tutte le entità SVG relative all'item
    dispose() {
        if(this.child) this.child.dispose();
        this.squares.forEach(square=>square.remove());
        if(this.border) this.border.remove();
    }
    
    // nasconde il bordo del rettangolo e visualizza i bordi dei quadrati e dell'eventuale figlio
    splitBorders() {
        this.border.hide();
        this.squares.forEach(square=>square.border.show());
        if(this.child) this.child.border.show();
    }

    // nasconde i bordi dei quadrati e dell'eventuale figlio e visualizza il bordo del rettangolo
    joinBorders() {
        this.border.show();
        this.squares.forEach(square=>square.border.hide());
        if(this.child) this.child.border.hide();
    }

    // procede nell'animazione: separa i quadrati. Se questo passo è già stato fatto fa avanzare il figlio
    stepForward() {
        if(this.state == 0) {
            let m = this.squares.length;
            this.splitBorders();
            this.squares.forEach((square, i) => {
                moveSquare(square, 1, 100, 0);
                let t = 50 + (m-1-i)*300;
                moveSquare(square, 2, 400, t);
                if(i>0 || this.child)
                    square.bg.animate(400,t + 400).opacity(0.2);     
            })
            this.state = 1;
        } else if(this.child) this.child.stepForward();
    }

    // torna indietro nell'animazione. Prima verifica che il figlio (se c'è) sia tornato all'inizio, poi unisce i quadrati
    stepBackward() {
        if(this.child && this.child.state > 0) this.child.stepBackward();
        else if(this.state > 0) {
            let anim;
            this.squares.forEach((square, i) => {
                square.bg.animate(400,0).opacity(1.0);     
                anim = moveSquare(square, 0, 200, 0);
            });
            if(anim) anim.after(()=>{ this.joinBorders() });
            this.state = 0;
            // this.border.show();
        } 
    }

    // torna true se l'animazione è completata
    isCompleted() { return this.state > 0 && (!this.child || this.child.isCompleted()); }

    open() {
        this.state = 1;
        this.splitBorders();
        this.squares.forEach(square => { moveSquare(square, 2, 50, 0); });
        if(this.child) this.child.open();
    }
    close() {
        this.state = 0;
        this.joinBorders();
        this.squares.forEach(square => { moveSquare(square, 0, 50, 0); });
        if(this.child) this.child.close();

    }
}


//
// gestisce la finestra SVG
// 
class Viewer {
    constructor(elementReference, width, height) {
        let draw = this.draw = SVG().addTo(elementReference).size(width, height);
        this.unit = 20;
        this.off = {x:2.5,y:2.5};
        //this.pattern.attr('patternContentUnits', 'objectBoundingBox');
    }

    dispose() {
        this.pattern.delete();
        this.pattern = null;
        this.u = 0;
        if(this.item) {
            this.item.dispose();
            this.item = null;
        }
    }
    
    // crea un singolo quadrato di lato sz (in pixel)
    // m è il lato del quadrato in unità di GCD
    createSquare(sz, m) {
        let group = this.draw.group();       
        group.bg = group.rect(sz,sz).fill('#8af').stroke('#8af'); 
        group.fg = group.rect(sz,sz).fill(this.pattern).stroke('none');

        for(let i = 0; i<=m; i++) {
            let c = sz*i/m;
            [group.line(0,c,sz,c), group.line(c,0,c,sz)].forEach(line => {
                line.stroke({width:0.5, color:"#478"}).addClass('gcd-square')
            })
        }
        group.border = group.rect(sz,sz).fill('none').stroke({width:1.5, color:"black"}).addClass('cuts');         
        return group; 
    }

    _createItem(a,b) {
        const mrg1 = 5, mrg2 = 40;
        let item = new Item(a,b)
        let g = gcd(a,b);
        if(a==b) {
            let square = this.createSquare(a*this.u, a/g);
            let lx = this.off.x + a * this.u;
            let ly = this.off.y + b * this.u;   
            let x = this.off.x;
            let y = this.off.y;                  
            square.positions = [{x,y},{x,y},{x,y}] 
            square.translate(x,y);
            item.squares.push(square);
            item.maxSize = { lx, ly }
        } else {
            let dir, squareSize, r, m, mg = 1;
            let firstSquarePos = {x:this.off.x, y:this.off.y};
            let mrg3 = mrg2;
            if(a>b) {
                dir = {x:1, y:0};
                squareSize = b * this.u;
                mg = b/g;
                r = a%b;
                m = Math.floor(a/b);
                if( r!=0 ) {
                    item.child = this._createItem(a%b, b);
                    firstSquarePos.x = this.off.x + r * this.u;                    
                    mrg3 = mrg2 + item.child.maxSize.lx - firstSquarePos.x;
                }
            } else {
                dir = {x:0, y:1};
                squareSize = a * this.u;
                mg = a/g;
                r = b%a;
                m = Math.floor(b/a);
                if(r != 0) {
                    item.child = this._createItem(a, b%a);
                    firstSquarePos.y = this.off.y + r * this.u; // item.child.maxSize.ly;
                    mrg3 = mrg2 + item.child.maxSize.ly - firstSquarePos.y;
                }
            }
            for(let i=0; i<m; i++) {
                let square = this.createSquare(squareSize, mg);
                square.positions = computeSquarePositions(firstSquarePos, dir, i, squareSize, mrg1, mrg3, item.child != null);
                let p = square.positions[0];
                square.translate(p.x, p.y);
                item.squares.push(square);
            }
            let lx = item.squares[m-1].positions[2].x + squareSize;
            let ly = item.squares[m-1].positions[2].y + squareSize;
            if(item.child) {
                lx = Math.max(lx, item.child.maxSize.lx);
                ly = Math.max(ly, item.child.maxSize.ly);
            }
            item.maxSize = { lx, ly }
            // item.outline = this.draw.rect(lx,ly).stroke('red').fill('none');
        }     
        if(item.child) item.child.border.hide();
        item.border = this.draw.rect(a*this.u, b*this.u).translate(this.off.x,this.off.y).stroke({width:1.5, color:'black'}).fill('none');
        return item;
       
    }

    // crea un nuovo item (cancellando quello che c'era prima)
    createItem(a,b) {
        let sz = Math.max(a,b);
        this.unit = 20;
        this.setPattern(this.unit);
        if(this.item) this.item.dispose();
        this.item = this._createItem(a,b);
        // brutto brutto!
        const mrg = 20;
        if(this.item.maxSize.lx > this.draw.width() - mrg || this.item.maxSize.ly > this.draw.height() - mrg) {
            let lx = this.item.maxSize.lx / this.unit;
            let ly = this.item.maxSize.ly / this.unit;
            while(this.unit * lx > this.draw.width() - mrg || this.unit * ly > this.draw.height() - mrg) {
                this.unit -= 4;
            }
            this.setPattern(this.unit);
            this.item.dispose();
            this.item = this._createItem(a,b);
        }
        /*
        if(sz <= 20) this.unit = 20;
        else this.unit = 10;
        this.setPattern(this.unit);
        if(this.item) this.item.dispose();
        this.item = this._createItem(a,b);
        */

        updateCuts();
        updateGcdSquares();
        // this.item.open();
        return this.item;   
    }

    setPattern(u) {
        if(u == this.u) return;
        this.u = u;
        if(this.pattern) this.pattern.remove(); 
        const d = u * 3/20;
        this.pattern = this.draw.pattern(u, u, function(add) {
            
            add.rect(u,u).fill('transparent');
            // add.rect(7,7).fill('red');
            add.circle(u-2*d).fill('transparent').stroke("#136").move(d,d);
        });
    }
}

// 20, 6
let viewer;

const controlsHtml = `
<div style="display:flex;flex-direction:column;width:400px">
    <p>
        A:<input type="number" name="A" id="A"  min="1" max="30" step="1" value="20" onchange="updateAB()">
        B:<input type="number" name="B" id="B"  min="1" max="20" step="1" value="6" onchange="updateAB()">
    </p>
    <p>
        <input type="checkbox" id="cutsCheck" onclick="updateCuts()"> Mostra i tagli<br>
        <input type="checkbox" id="gcdSquaresCheck" onclick="updateGcdSquares()"> Mostra i quadretti<br>
        
    </p>
    <p>
        <button id="stepBackwardBtn" onclick="stepBackward()" disabled>Indietro</button>
        <button id="stepForwardBtn" onclick="stepForward()">Avanti</button>
    </p>
    <p id="output" style="font-size:24px"></p>
    <p id="output2" style="font-size:24px"></p>
    
</div>
<div id="drawing"></div>    
`;

function initialize() {
    let styleEl = document.createElement('style'), styleSheet;
    document.head.appendChild(styleEl);
    styleSheet = styleEl.sheet;
    styleSheet.insertRule("SVG { border: solid 1px black; }", 0);

    let animationDiv = document.getElementById("animation");
    animationDiv.style.display = "flex";
    animationDiv.style.flexDirection = "row";

    animationDiv.innerHTML = controlsHtml;
    viewer = new Viewer('#drawing', 620, 620);
    updateAB();
}

function updateButtonsState() {
    let forwardBtn = document.getElementById('stepForwardBtn');
    let backwardBtn = document.getElementById('stepBackwardBtn');
    if(!viewer?.item) forwardBtn.disabled = backwardBtn.disabled = true;
    else
    {
        forwardBtn.disabled = viewer.item.isCompleted();
        backwardBtn.disabled = viewer.item.state == 0;
    } 
}

function stepForward() {
    let item = viewer?.item;
    if(item) {
        item.stepForward();
        updateStatusMessage();
    }
    updateButtonsState();
}

function stepBackward() {
    let item = viewer?.item;
    if(item) {
        item.stepBackward();
        updateStatusMessage();
    }
    updateButtonsState();
}

function updateCuts() {
    let selector = SVG.find(".cuts");
    if(document.getElementById('cutsCheck').checked) 
        selector.show(); 
    else 
        selector.hide();
}

function updateGcdSquares() {
    let selector = SVG.find(".gcd-square");
    if(document.getElementById('gcdSquaresCheck').checked) 
        selector.show(); 
    else 
        selector.hide();
}

document.addEventListener('DOMContentLoaded', (event) => {
    initialize();
});

function updateStatusMessage() {
    let output = document.getElementById('output');

    let msg = "";

    let item = viewer.item;
    while(item) {
        let {a,b} = item;
        if(msg != "") msg += "<br>"
        msg += GCD+"(" + a + ", " + b + ") = ";
        if(item.state == 0) {
            msg += "?";
            break;
        }
        else if(item.child == null) {
            msg += Math.min(a,b);
            break;            
        }
        item = item.child;
    }

    output.innerHTML = msg;

    output = document.getElementById('output2');
    msg = "";
    item = viewer.item;
    while(item && item.state > 0) {
        if(msg != "") msg += "<br>"
        let {a,b} = item;
        if(a>b) 
            msg += `${a} = ${b} x ${Math.floor(a/b)} + ${a%b}`;
        else if(a<b) 
            msg += `${b} = ${a} x ${Math.floor(b/a)} + ${b%a}`;
        item = item.child;
    }
    output.innerHTML = msg;
}

function updateAB() {
    let a = document.getElementById("A").valueAsNumber;
    let b = document.getElementById("B").valueAsNumber;
    viewer.createItem(a,b);   
    updateStatusMessage(); 
    updateButtonsState();
}

