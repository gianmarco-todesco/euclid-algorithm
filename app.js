

class Viewer {
    constructor(elementReference) {
        let draw = this.draw = SVG().addTo(elementReference).size(900, 900);

        //this.pattern.attr('patternContentUnits', 'objectBoundingBox');
    }


    createItem(a,b) {
        this.setPattern(20);
        if(this.item) {
            this.item.dispose();
            this.item = null;
        }
        this.item = new Item(this, 0,0,a,b);        
    }

    setPattern(u) {
        if(u == this.u) return;
        this.u = u;
        if(this.pattern) this.pattern.remove(); 
        const d = 3;
        this.pattern = this.draw.pattern(u, u, function(add) {
            add.rect(u,u).fill('#47F');
            add.circle(u-2*d).fill('#36e').stroke("#136").move(d,d);
        });
    }

    createRect(x,y,w,h) {
        x = this.u * x + 0.5;
        y = this.u * y + 0.5;
        w = this.u * w;
        h = this.u * h;
        return this.draw.rect(w,h).fill(this.pattern).stroke("black").move(x,y);        
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

    getStatusMessage() {
        if(!this.item) return "";
        const {a,b} = this.item;
        const [aa,bb] = this.item.getCurrentSize();
        let msg = "GCD(" + a + ", " + b + ") = ";
        if(a==aa && b==bb) msg += "?";
        else if(aa==bb) msg += aa;
        else msg += "GCD(" + aa + ", " + bb + ")";
        return msg;        
    }
}

class Item {
    constructor(rectMaker, x0, y0, a, b) {
        this.a = a;
        this.b = b;
        this.curA = a;
        this.curB = b;
        this.squares = [];
        this.child = null;
        this.state = 0;
        this.rect = rectMaker.createRect(x0,y0,a,b);
        if(a>=b) {
            let r = a%b;
            for(let i=0; r+b*(i+1)<=a;i++) 
                this.squares.push(rectMaker.createRect(x0+r+b*i,y0,b,b));
            if(r!=0)
                this.child = new Item(rectMaker,x0,y0,r,b);
        } else {
            let r = b%a;
            for(let i=0; r+a*(i+1)<=b;i++) 
                this.squares.push(rectMaker.createRect(x0,y0+r+a*i,a,a));
            if(r!=0) this.child = new Item(rectMaker,x0,y0,a,r);
        }
        this.squares.forEach(square=>square.hide());
        let c = this.child;
        while(c) {c.rect.hide();c=c.child;}

    }

    stepForward() {
        if(this.state == 0) {
            this.rect.hide();
            this.squares.forEach(square=>square.show());
            if(this.child) this.child.rect.show();
            this.state = 1;
        } else if (this.state<=this.squares.length) {
            let j = this.squares.length - this.state;
            let d = 100 + 30 * (j-1);
            let horizontal = this.a >= this.b;
            let dx = horizontal ? d : 0, dy = horizontal ? 0 : d;     
            let square = this.squares[j];       
            square.animate().translate(dx,dy).animate().opacity(0).after(()=>square.hide());
            if(horizontal) this.curA = this.a - this.state * this.b;
            else this.curB = this.b - this.state * this.a;
            this.state += 1;
        } else {
            this.child.stepForward();
        }
    }

    dispose() {
        if(this.child) this.child.dispose();
        this.rect.remove();
        this.squares.forEach(square=>square.remove());
    }

    getCurrentSize() {
        if(this.state <= this.squares.length) return [this.curA, this.curB];
        else if(this.child) return this.child.getCurrentSize();
        else return [0,0];
    }
}

let viewer;

function initialize() {
    viewer = new Viewer('#drawing');
    foo();
    document.getElementById("output").innerHTML = "GCD(" + viewer.item.a + "," + viewer.item.b + ") = ?"
}


function stepForward() {
    let item = viewer?.item;
    if(item) {
        item.stepForward();
        updateStatusMessage();
    }
}

document.addEventListener('DOMContentLoaded', (event) => {
    initialize();


    /*

    rect.node.addEventListener('click', () => {
        // Get current x position
        const currentX = rect.x();

        // Move rectangle 50 pixels to the right
        rect.move(currentX + 50, rect.y());
    });
    */
});

function updateStatusMessage() {
    let msg = viewer.getStatusMessage();
    document.getElementById('output').innerHTML = msg;
}

function foo() {
    let a = document.getElementById("A").valueAsNumber;
    let b = document.getElementById("B").valueAsNumber;
    viewer.createItem(a,b);   
    updateStatusMessage(); 
}

