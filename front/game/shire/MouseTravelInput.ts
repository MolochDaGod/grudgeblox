/** Mouse chord state kept separate from keyboard movement and pointer capture. */
export class MouseTravelInput {
  left=false
  right=false
  private chord=false
  private distance=0
  get forward(){return this.left&&this.right}
  press(button:number,buttons:number){
    if(button!==0&&button!==2)return
    this.left=!!(buttons&1);this.right=!!(buttons&2)
    if(button===2)this.distance=0
    if(this.forward)this.chord=true
  }
  motion(dx:number,dy:number){if(this.right)this.distance+=Math.hypot(dx,dy)}
  release(button:number):'point'|'primary'|undefined{
    const result=button===2&&this.right&&!this.chord&&this.distance<5?'point':button===0&&this.left&&!this.chord?'primary':undefined
    if(button===0)this.left=false
    if(button===2)this.right=false
    if(!this.left&&!this.right)this.chord=false
    return result
  }
  reset(){this.left=false;this.right=false;this.chord=false;this.distance=0}
}
