"""Original, metre-scale Shire characters. One independent Blender project per entity.

Run through Blender's background Python. The saved native project, rig, actions,
GLB and rendered views are retained together; this is Blender-authored geometry.
It does not claim image-to-3D or Hunyuan provenance.
"""
import bpy, math, json, sys, hashlib, random
from pathlib import Path
from mathutils import Vector, Quaternion

ROOT = Path(r'E:\GrudgeBloxData\TheMiddleEarth\assets\shire-life')
ROOT.mkdir(parents=True, exist_ok=True)
KINDS = ['sheep','chicken','cattle','pig','horse','fish','llama','bird','frog','hobbit-male','hobbit-female']
args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
selected = args or KINDS
PALETTE = {
 'cream':'e4d5b5','wool':'e8e0cd','dark':'34312e','hoof':'443b31','eye':'141a18','glint':'fff6d3',
 'chestnut':'865438','tan':'bb8b5b','mane':'4c352b','pink':'c78479','pinklight':'dfaea0','snout':'a95b59',
 'ivory':'e3cf9b','red':'ad4e3c','gold':'bc8f40','sage':'738664','forest':'405940','blue':'537985',
 'skin':'c7916d','skinlight':'dfb18a','hair':'6d4a2e','linen':'d1c29e','waistcoat':'63734b','trousers':'665648',
 'leather':'765138','apron':'d6ceb4','brass':'b99451','reed':'536950','belly':'bcc597','orange':'b38140'}

def colour(hexvalue):
    def linear(c):return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
    return tuple(linear(int(hexvalue[i:i+2],16)/255) for i in (0,2,4))+(1,)

class Author:
    def __init__(self, kind):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.kind=kind; self.meshes=[]; self.bindings=[]; self.bones={}; self.actions=[]
        self.folder=ROOT/kind; self.folder.mkdir(exist_ok=True)
        self.materials={}
        random.seed(412+sum(map(ord,kind)))
        for name,hexvalue in PALETTE.items():
            m=bpy.data.materials.new(name.title());m.diffuse_color=colour(hexvalue);m.use_nodes=True
            bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=m.diffuse_color
            bs.inputs['Roughness'].default_value=.78 if name not in ['eye','glint','brass'] else .24
            if name=='brass':bs.inputs['Metallic'].default_value=.65
            self.materials[name]=m
        self.bone('root',(0,0,0),(0,0,.15))

    def bone(self,name,head,tail,parent='root'):
        self.bones[name]=(head,tail,parent)

    def mesh(self,obj,name,mat,bone='body'):
        obj.name=name;obj.data.materials.append(self.materials[mat]);self.meshes.append(obj);self.bindings.append((obj,bone))
        for p in obj.data.polygons:p.use_smooth=True
        return obj

    def ell(self,name,pos,scale,mat,bone='body',segments=20,rings=12):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=pos)
        obj=bpy.context.object;obj.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        return self.mesh(obj,name,mat,bone)

    def rod(self,name,a,b,r,mat,bone='body',r2=None,vertices=12):
        delta=Vector(b)-Vector(a)
        bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=r if r2 is None else r2,depth=delta.length,location=(Vector(a)+Vector(b))/2)
        obj=bpy.context.object;obj.rotation_euler=delta.to_track_quat('Z','Y').to_euler();bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
        bevel=obj.modifiers.new('Soft carved edges','BEVEL');bevel.width=min(.02,r*.2);bevel.segments=2
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=bevel.name)
        return self.mesh(obj,name,mat,bone)

    def eyes(self,x,y,z,r=.035,bone='head',forward=True):
        for side in [-1,1]:
            self.ell('Warm dark eye',(side*x,y,z),(r,r*.72,r),'eye',bone)
            self.ell('Eye catchlight',(side*x-r*.2,y-r*.56,z+r*.27),(r*.18,r*.15,r*.18),'glint',bone,12,8)

    def quadruped(self):
        kind=self.kind
        cfg={
          'sheep':(.68,.36,.68,.62,'cream',.3,.35),
          'cattle':(1.12,.48,.9,.78,'cream',.38,.45),
          'pig':(.58,.34,.62,.5,'pink',.28,.3),
          'horse':(1.05,.36,.78,.68,'chestnut',.3,.45),
          'llama':(.96,.32,.63,.65,'tan',.22,.52)}[kind]
        z,wide,long,bodyheight,coat,headw,neck=cfg
        self.bone('body',(0,.15,z-.25),(0,-.3,z))
        self.bone('head',(0,-long*.64,z),(0,-long-.1,z+neck*.75),'body')
        self.bone('tail',(0,long*.85,z),(0,long+ .4,z-.15),'body')
        self.ell('Torso',(0,0,z),(wide,long,bodyheight*.55),coat)
        self.ell('Chest',(0,-long*.5,z),(wide*.92,long*.5,bodyheight*.56),coat)
        self.ell('Haunches',(0,long*.55,z),(wide*.95,long*.45,bodyheight*.52),coat)
        for side in [-1,1]:
            for fore in [True,False]:
                x=side*wide*.64;y=(-1 if fore else 1)*long*.64
                name=('front' if fore else 'hind')+('_L' if side<0 else '_R')
                self.bone(name,(x,y,z-.15),(x,y,.12),'body')
                self.ell(name+' upper',(x,y,z*.63),(.105 if kind!='cattle' else .14,.12,z*.36),coat,name)
                self.rod(name+' lower',(x,y,z*.5),(x,y,.1),.063 if kind not in ['cattle','pig'] else .08,coat,name)
                self.ell(name+' foot',(x,y-.035,.08),(.09,.14,.08),'hoof' if kind!='pig' else 'snout',name)
                if kind in ['sheep','cattle','pig','llama']:
                    self.rod(name+' split hoof',(x,y-.165,.025),(x,y-.17,.12),.008,'dark',name)
        headz=z+(neck if kind in ['horse','llama'] else .12)
        if kind in ['horse','llama']:
            self.rod('Upright neck',(0,-long*.6,z),(0,-long*.85,headz),wide*.64,coat,'head',wide*.52)
        heady=-long-.07
        self.ell('Head',(0,heady,headz),(headw,headw*.85,headw*.95),coat,'head')
        muzzle=.3 if kind=='horse' else .22 if kind=='cattle' else .15
        self.ell('Muzzle',(0,heady-muzzle,headz-.09),(headw*.78,muzzle*.95,headw*.58),'pinklight' if kind in ['pig','cattle'] else 'cream' if kind=='sheep' else coat,'head')
        for side in [-1,1]:
            ear=self.ell('Ear',(side*headw*.95,heady+.015,headz+headw*.7),(.08,.08,.2 if kind in ['horse','llama'] else .15),coat,'head')
            ear.rotation_euler.y=side*(.22 if kind in ['horse','llama'] else .95)
            inside=self.ell('Inner ear',(side*headw*.99,heady-.05,headz+headw*.72),(.045,.025,.13 if kind in ['horse','llama'] else .09),'pink','head');inside.rotation_euler.y=ear.rotation_euler.y
            self.ell('Nostril',(side*headw*.4,heady-muzzle*1.8,headz-.07),(.024,.012,.018),'dark','head',12,8)
        self.eyes(headw*.69,heady-headw*.6,headz+.025,.035 if kind!='pig' else .027)
        if kind=='sheep':
            for ring in range(7):
                y=-long*.77+ring*long*.26
                for i in range(11):
                    a=2*math.pi*i/11+(ring%2)*.15;self.ell('Wool lock',(math.cos(a)*wide*.91,y+random.uniform(-.035,.035),z+math.sin(a)*bodyheight*.48),(.11+random.random()*.03,.13+random.random()*.035,.1+random.random()*.035),'wool','body',12,8)
            for i in range(8):self.ell('Forelock',((i%3-1)*.09,heady+.04,headz+.22+(i//3)*.028),(.105,.1,.08),'wool','head',12,8)
        elif kind=='cattle':
            # Coat markings live on the skin surface, never as floating shapes.
            for body in self.meshes:
                if body.name not in ['Torso','Chest','Haunches']:continue
                body.data.materials.append(self.materials['chestnut'])
                for face in body.data.polygons:
                    p=body.matrix_world@face.center
                    if abs(face.normal.x)>.45 and math.sin(p.y*8+p.z*3)+math.cos(p.z*9-p.y*2)>.25:face.material_index=1
            for side in [-1,1]:
                self.rod('Horn',(side*.23,heady,headz+.24),(side*.34,heady+.025,headz+.5),.065,'ivory','head',.006)
            self.ell('Udder',(0,.48,z-.46),(.18,.16,.12),'pink')
        elif kind=='horse':
            for i in range(9):
                t=i/8;self.ell('Layered mane',(0,-long*.65-.15*t,z+.14+neck*t),(.1,.14,.16),'mane','head',12,8)
            self.ell('Forehead blaze',(0,heady-.22,headz+.05),(.055,.018,.18),'cream','head')
        elif kind=='pig':
            self.ell('Snout disc',(0,heady-.29,headz-.08),(.17,.045,.105),'snout','head')
            for side in [-1,1]:self.ell('Snout nostril',(side*.06,heady-.334,headz-.07),(.025,.011,.03),'dark','head',12,8)
        elif kind=='llama':
            for i in range(9):self.ell('Neck wool',(0,-long*.8,headz-.08-i*.05),(.19,.17,.1),'cream','head',12,8)
        if kind=='pig':
            last=(0,long*.95,z)
            for i in range(18):
                a=i*.5;p=(math.sin(a)*.07,long+.07+i*.005,z+math.cos(a)*.07);self.rod('Curled tail',last,p,.025,'pink','tail');last=p
        else:
            end=(0,long+.25,z-(.6 if kind in ['horse','cattle'] else .12))
            self.rod('Tail',(0,long*.9,z),end,.05,coat,'tail',.04)
            self.ell('Tail tuft',end,(.11,.12,.24 if kind=='horse' else .1),'mane' if kind in ['horse','cattle'] else coat,'tail')

    def avian(self):
        chicken=self.kind=='chicken';scale=1 if chicken else .64;z=.44 if chicken else .26
        self.bone('body',(0,0,z-.12),(0,-.15,z));self.bone('head',(0,-.2,z),(0,-.32,z+.26),'body')
        self.ell('Feathered breast',(0,0,z),(.22*scale,.3*scale,.28*scale),'chestnut' if chicken else 'blue')
        self.ell('Head',(0,-.26*scale,z+.27*scale),(.125*scale,.14*scale,.14*scale),'tan' if chicken else 'blue','head')
        self.rod('Beak',(0,-.37*scale,z+.25*scale),(0,-.52*scale,z+.22*scale),.065*scale,'gold','head',.004)
        self.eyes(.085*scale,-.36*scale,z+.29*scale,.018*scale)
        if chicken:
            for i in range(5):self.ell('Red comb',(0,-.31+i*.028,z+.405+(i%2)*.035),(.034,.035,.07),'red','head',12,8)
            self.ell('Wattle',(0,-.35,z+.14),(.038,.028,.09),'red','head')
        for side in [-1,1]:
            wing='wing_L' if side<0 else 'wing_R';self.bone(wing,(side*.17*scale,0,z+.1),(side*.7*scale,.03,z+.04),'body')
            self.ell('Folded wing',(side*.22*scale,.045,z),(.08*scale,.25*scale,.2*scale),'tan' if chicken else 'sage',wing)
            for i in range(6):self.ell('Flight feather',(side*(.22+i*.018)*scale,(.03+i*.035)*scale,z-.12*scale),(.045*scale,.19*scale,.045*scale),'cream' if chicken else 'dark',wing,12,8)
            leg='front_L' if side<0 else 'front_R';self.bone(leg,(side*.11*scale,0,z-.1),(side*.11*scale,0,.04),'body')
            self.rod('Scaly leg',(side*.11*scale,0,z-.1),(side*.11*scale,0,.045),.025*scale,'gold',leg)
            for toe in [-1,0,1]:self.rod('Toe',(side*.11*scale,0,.035),(side*.11*scale+toe*.06*scale,-.1*scale,.025),.014*scale,'gold',leg,.006)
        self.bone('tail',(0,.2*scale,z),(0,.5*scale,z+.2*scale),'body')
        for i in range(7):
            feather=self.ell('Tail feather',((i-3)*.038*scale,.29*scale,z+.14*scale),(.035*scale,.21*scale,.08*scale),'dark' if i%2 else 'cream','tail',12,8);feather.rotation_euler.x=.6

    def aquatic(self):
        frog=self.kind=='frog'
        self.bone('body',(0,0,.1),(0,-.15,.17));self.bone('head',(0,-.12,.15),(0,-.26,.18),'body');self.bone('tail',(0,.18,.15),(0,.46,.15),'body')
        if frog:
            self.ell('Frog body',(0,.02,.16),(.17,.22,.12),'sage');self.ell('Pale belly',(0,-.025,.095),(.15,.18,.06),'belly')
            self.ell('Broad frog head',(0,-.16,.19),(.2,.15,.12),'sage','head')
            for side in [-1,1]:
                self.ell('Raised eye',(side*.125,-.2,.29),(.069,.064,.061),'gold','head')
                self.ell('Horizontal pupil',(side*.125,-.259,.291),(.045,.013,.022),'eye','head')
                for fore in [True,False]:
                    limb=('front' if fore else 'hind')+('_L' if side<0 else '_R');y=-.12 if fore else .12
                    self.bone(limb,(side*.1,y,.14),(side*.28,y-.1,.04),'body')
                    self.ell('Folded leg',(side*.22,y,.085),(.11,.12,.064),'sage',limb)
                    for toe in range(3):self.rod('Webbed toe',(side*.24,y-.08,.035),(side*(.2+toe*.04),y-.19,.023),.016,'sage',limb,.007)
            for i in range(12):
                x=(i%4-1.5)*.07;y=.015+(i//4)*.057
                z=.16+.12*math.sqrt(max(0,1-(x/.17)**2-((y-.02)/.22)**2))
                self.ell('Frog back marking',(x,y,z),(.024,.028,.005),'reed','body',12,8)
        else:
            self.ell('Streamlined fish',(0,0,.17),(.1,.31,.16),'blue');self.ell('Silver belly',(0,-.015,.1),(.09,.28,.075),'cream')
            self.ell('Fish head',(0,-.24,.17),(.092,.11,.115),'sage','head')
            self.eyes(.074,-.305,.205,.026)
            for side in [-1,1]:
                for i in range(8):
                    z1=.10+i*.016;z2=z1+.016
                    def gillx(z):return side*(.1*math.sqrt(max(0,1-(.17/.31)**2-((z-.17)/.16)**2))+.001)
                    self.rod('Curved gill',(gillx(z1),-.17,z1),(gillx(z2),-.17,z2),.0025,'dark')
                fin=self.ell('Pectoral fin',(side*.12,-.065,.12),(.09,.07,.014),'orange');fin.rotation_euler.y=side*.4
            self.ell('Dorsal fin',(0,.015,.33),(.015,.15,.09),'orange')
            for side in [-1,1]:
                fin=self.ell('Forked tail',(0,.37,.17+side*.09),(.018,.12,.115),'gold','tail');fin.rotation_euler.x=side*.55
            for row in range(5):
                y=-.1+row*.067;z=.19+(row%2)*.025
                x=.1*math.sqrt(max(0,1-(y/.31)**2-((z-.17)/.16)**2))
                for side in [-1,1]:self.ell('Scale highlight',(side*x,y,z),(.003,.017,.014),'cream','body',10,6)

    def hobbit(self):
        female=self.kind.endswith('female');z=.71
        self.bone('body',(0,0,.5),(0,0,.9));self.bone('head',(0,0,.94),(0,0,1.21),'body')
        self.ell('Linen shirt',(0,0,.82),(.215,.145,.23),'linen')
        self.ell('Tailored waistcoat',(0,-.014,.80),(.229,.16,.215),'blue' if female else 'waistcoat')
        self.ell('Waistcoat back',(0,.105,.835),(.20,.055,.18),'blue' if female else 'waistcoat')
        for side in [-1,1]:
            lapel=self.ell('Waistcoat lapel',(side*.055,-.164,.87),(.026,.018,.095),'leather');lapel.rotation_euler.y=side*.42
        for i in range(4):self.ell('Brass button',(0,-.172,.9-i*.058),(.014,.011,.014),'brass',segments=12,rings=8)
        for side in [-1,1]:
            leg='front_L' if side<0 else 'front_R';self.bone(leg,(side*.105,0,.55),(side*.105,-.02,.12),'body')
            self.ell('Cropped trousers',(side*.105,0,.38),(.095,.115,.22),'trousers',leg)
            self.rod('Bare lower leg',(side*.105,0,.28),(side*.105,-.012,.1),.066,'skin',leg)
            self.ell('Bare Hobbit foot',(side*.12,-.085,.075),(.115,.2,.07),'skinlight',leg)
            for toe in range(5):self.ell('Toe',(side*.12+(toe-2)*.034,-.235,.069),(.022,.039,.03),'skinlight',leg,12,8)
            for i in range(9):self.ell('Foot curls',(side*.12+(i%3-1)*.04,-.04-i//3*.04,.13),(.025,.03,.014),'hair',leg,10,6)
            arm='arm_L' if side<0 else 'arm_R';self.bone(arm,(side*.22,0,.94),(side*.33,-.01,.57),'body')
            self.ell('Rolled sleeve',(side*.25,0,.82),(.092,.095,.17),'linen',arm)
            self.rod('Forearm',(side*.29,0,.75),(side*.335,-.03,.61),.06,'skin',arm)
            self.ell('Hand',(side*.337,-.035,.56),(.06,.043,.078),'skinlight',arm)
            for finger in range(4):self.rod('Finger',(side*.34+(finger-1.5)*.022,-.035,.545),(side*.34+(finger-1.5)*.022,-.041,.485+(finger%3)*.007),.013,'skinlight',arm,.011)
            self.rod('Thumb',(side*.30,-.037,.575),(side*.28,-.057,.535),.02,'skinlight',arm,.013)
        if female:
            verts=[(-.13,-.17,.67),(.13,-.17,.67),(.18,-.155,.4),(-.18,-.155,.4)]
            data=bpy.data.meshes.new('Apron cloth');data.from_pydata(verts,[],[(0,1,2,3)]);data.update()
            apron=bpy.data.objects.new('Garden apron',data);bpy.context.collection.objects.link(apron);self.mesh(apron,'Garden apron','apron')
            solid=apron.modifiers.new('Cloth thickness','SOLIDIFY');solid.thickness=.008
            bevel=apron.modifiers.new('Soft hem','BEVEL');bevel.width=.009;bevel.segments=2
            self.ell('Apron pocket',(0,-.169,.53),(.064,.009,.041),'linen')
        self.rod('Neck',(0,0,.96),(0,0,1.035),.083,'skin','head')
        self.ell('Face',(0,-.006,1.145),(.16,.132,.186),'skinlight','head',24,16)
        for side in [-1,1]:
            ear=self.ell('Hobbit ear',(side*.163,.005,1.165),(.05,.028,.072),'skin','head');ear.rotation_euler.y=side*.28
            self.ell('Rosy cheek',(side*.08,-.119,1.105),(.059,.025,.042),'skin','head')
            self.rod('Eyebrow',(side*.038,-.13,1.214),(side*.103,-.104,1.217),.011,'hair','head')
        self.eyes(.065,-.132,1.18,.026)
        self.ell('Round nose',(0,-.15,1.135),(.037,.047,.041),'skin','head')
        self.rod('Gentle smile',(-.043,-.132,1.075),(.043,-.132,1.075),.008,'snout','head')
        self.ell('Hair crown',(0,.005,1.305),(.145,.126,.073),'hair','head')
        for ring in range(3):
            radius=.045*ring
            for i in range(max(1,ring*9)):
                a=i*math.tau/max(1,ring*9);x=math.cos(a)*radius;y=.005+math.sin(a)*radius
                zz=1.305+.073*math.sqrt(max(0,1-(x/.145)**2-((y-.005)/.126)**2))
                self.ell('Crown curl',(x,y,zz),(.035,.035,.025),'hair','head',12,8)
        for ring in range(3):
            for i in range(15):
                a=i*math.tau/15;y=math.sin(a)*.125;zz=1.235+ring*.025
                if y<-.03 and ring==0:continue
                self.ell('Curly hair',(math.cos(a)*.145,y,zz),(.042,.043,.046),'hair','head',12,8)
        if female:
            for side in [-1,1]:
                for i in range(6):self.ell('Side braid',(side*.152,.05,1.19-i*.045),(.041,.046,.035),'hair','head',12,8)
        else:self.ell('Forelock',(.04,-.08,1.307),(.095,.066,.042),'hair','head')

    def rig(self):
        data=bpy.data.armatures.new(self.kind+' skeleton');rig=bpy.data.objects.new(self.kind+' rig',data);bpy.context.collection.objects.link(rig)
        bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
        for name,(head,tail,parent) in self.bones.items():
            b=data.edit_bones.new(name);b.head=head;b.tail=tail
            if name!='root':b.parent=data.edit_bones[parent]
        bpy.ops.object.mode_set(mode='OBJECT');self.rigobj=rig
        for mesh,bone in self.bindings:
            mesh.parent=rig;group=mesh.vertex_groups.new(name=bone);group.add(list(range(len(mesh.data.vertices))),1,'REPLACE');mod=mesh.modifiers.new('Character rig','ARMATURE');mod.object=rig
        rig.animation_data_create()
        self.clips=['idle','walk','run','eat','rest','hit','death']
        if self.kind=='fish':self.clips+=['swim']
        if self.kind in ['bird','chicken']:self.clips+=['fly','perch']
        for clip in self.clips:
            action=bpy.data.actions.new(clip);rig.animation_data.action=action;action.use_fake_user=True;self.actions.append(action)
            for frame in range(1,49,3):
                t=(frame-1)/48;wave=math.sin(t*math.tau)
                for bone in rig.pose.bones:
                    bone.rotation_mode='XYZ';bone.rotation_euler=(0,0,0);bone.location=(0,0,0)
                    name=bone.name
                    # Pose in world-rest axes; Blender bones point along local Y,
                    # so using raw local Euler axes can turn a fall into a spin.
                    inverse=bone.bone.matrix_local.to_quaternion().inverted()
                    def rotate(axis,angle):bone.rotation_euler=Quaternion(inverse@Vector(axis),angle).to_euler()
                    def translate(delta):bone.location=inverse@Vector(delta)
                    if clip in ['walk','run']:
                        amplitude=.48 if clip=='run' else .28
                        phase=wave*(-1 if name.endswith('_L') else 1)*(-1 if name.startswith('hind') else 1)
                        if name.startswith(('front','hind','arm')):rotate((1,0,0),phase*amplitude)
                        if name.startswith(('front','hind')):translate((0,0,max(0,phase)*(.045 if clip=='walk' else .075)))
                    elif clip=='eat' and name=='head':rotate((1,0,0),.38+wave*.06)
                    elif clip=='rest':
                        if name.startswith(('front','hind')):rotate((1,0,0),(-1 if name.startswith('front') else 1)*1.05)
                        if name=='body':rotate((1,0,0),.03)
                        if name=='head':rotate((1,0,0),.1+wave*.01)
                    elif clip=='hit' and name=='body':rotate((0,1,0),math.sin(t*math.pi)*.18)
                    elif clip=='death':
                        if name=='root':rotate((0,1,0),min(1,t*2)*1.48)
                        if name=='head':rotate((1,0,0),min(1,t*2)*.2)
                    elif clip in ['fly','perch']:
                        if name.startswith('wing'):rotate((0,1,0),(.8+wave*.65 if clip=='fly' else .08)*(1 if name.endswith('_L') else -1))
                        if name=='body' and clip=='fly':translate((0,0,wave*.03))
                    if name=='tail' and clip not in ['death','rest']:rotate((0,0,1),wave*(.42 if self.kind=='fish' else .13))
                    if clip=='swim' and name=='body':rotate((0,0,1),wave*.075)
                    if clip=='idle' and name=='head':rotate((1,0,1),wave*.025)
                    bone.keyframe_insert(data_path='rotation_euler',frame=frame,group=name);bone.keyframe_insert(data_path='location',frame=frame,group=name)
            # Explicit loop end matches the first frame, except one-shot death.
            for bone in rig.pose.bones:
                if clip!='death':
                    bpy.context.scene.frame_set(1)
                bone.keyframe_insert(data_path='rotation_euler',frame=49,group=bone.name);bone.keyframe_insert(data_path='location',frame=49,group=bone.name)
        rig.animation_data.action=self.actions[0];bpy.context.scene.frame_set(1)
        for bone in rig.pose.bones:bone.rotation_euler=(0,0,0);bone.location=(0,0,0)

    def save(self):
        scene=bpy.context.scene;scene.render.fps=24;scene.frame_start=1;scene.frame_end=49
        scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
        # A single skinned mesh keeps the material draw budget small in populated scenes.
        for o in bpy.context.selected_objects:o.select_set(False)
        for o in self.meshes:o.select_set(True)
        bpy.context.view_layer.objects.active=self.meshes[0];bpy.ops.object.join();combined=bpy.context.object;combined.name=self.kind+' skinned character';self.meshes=[combined]
        # Keep one supporting foot (or the fallen/resting body) on the ground.
        # This corrects the complete posed mesh rather than assuming limb lengths.
        contact=[]
        if self.kind!='fish':
            root=self.rigobj.pose.bones['root'];inverse=root.bone.matrix_local.to_quaternion().inverted()
            for action in self.actions:
                if action.name=='fly':continue
                self.rigobj.animation_data.action=action
                for frame in list(range(1,49,3))+[49]:
                    scene.frame_set(frame);root.location=(0,0,0);bpy.context.view_layer.update()
                    evaluated=combined.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh()
                    minimum=min((evaluated.matrix_world@v.co).z for v in mesh.vertices);evaluated.to_mesh_clear()
                    root.location=inverse@Vector((0,0,-minimum));root.keyframe_insert(data_path='location',frame=frame,group='root')
                    contact.append({'clip':action.name,'frame':frame,'verticalCorrection':-minimum})
        self.rigobj.animation_data.action=self.actions[0];scene.frame_set(1)
        (self.folder/'motion-ground-contact.json').write_text(json.dumps(contact,indent=2),encoding='utf-8')
        for o in bpy.context.selected_objects:o.select_set(False)
        for o in self.meshes+[self.rigobj]:o.select_set(True)
        bpy.context.view_layer.objects.active=self.rigobj
        out=self.folder/(self.kind+'.glb')
        bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_yup=True,export_apply=False,export_cameras=False,export_lights=False)
        # Keep a composed studio in the native project, outside the runtime export.
        scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
        scene.render.resolution_x=760;scene.render.resolution_y=760;scene.render.resolution_percentage=100
        if scene.world is None:scene.world=bpy.data.worlds.new('Shire studio world')
        scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.24,.29,.27,1);scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.3
        bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.018));plane=bpy.context.object;plane.name='Studio ground — not exported';plane.data.materials.append(self.materials['cream'])
        for name,pos,power,size in [('Key',(-3,-4,6),650,4),('Fill',(4,-1,3),320,3),('Rim',(0,4,5),700,3)]:
            data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=pos;obj.rotation_euler=(Vector((0,0,.7))-obj.location).to_track_quat('-Z','Y').to_euler()
        camera_data=bpy.data.cameras.new('Asset review');camera=bpy.data.objects.new('Asset review',camera_data);bpy.context.collection.objects.link(camera);scene.camera=camera;camera_data.type='ORTHO'
        coords=[m.matrix_world@Vector(c) for m in self.meshes for c in m.bound_box];mins=[min(p[i] for p in coords) for i in range(3)];maxs=[max(p[i] for p in coords) for i in range(3)];dimensions=[maxs[i]-mins[i] for i in range(3)];center=Vector((0,0,(maxs[2]+mins[2])/2));camera_data.ortho_scale=max(dimensions)*1.4
        scene.view_settings.view_transform='AgX';scene.view_settings.exposure=-.8;scene.render.image_settings.file_format='PNG'
        views=[('front',(2,-4,2.1),'idle',1),('side',(4,0,1.8),'idle',1),('rear',(-2,4,2),'idle',1),('walk-contact',(2,-4,2.1),'walk',13),('walk-opposite',(2,-4,2.1),'walk',37),('rest',(2,-4,2.1),'rest',1)]
        for label,position,clip,frame in views:
            self.rigobj.animation_data.action=next(a for a in self.actions if a.name==clip);scene.frame_set(frame);camera.location=center+Vector(position);camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(self.folder/(label+'.png'));bpy.ops.render.render(write_still=True)
        self.rigobj.animation_data.action=self.actions[0];scene.frame_set(1)
        bpy.ops.wm.save_as_mainfile(filepath=str(self.folder/(self.kind+'.blend')))
        metadata={'id':('resident-'+self.kind) if self.kind.startswith('hobbit') else ('animal-'+self.kind),'entity':self.kind,'file':str(out),'nativeProject':str(self.folder/(self.kind+'.blend')),'authoring':'Original Blender-authored meshes, PBR materials and per-entity armature actions','units':'metres','dimensionsXYZ_Blender':dimensions,'forward_Blender':'-Y','forward_glTF':'+Z','groundZ':mins[2],'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'byteSize':out.stat().st_size,'animations':self.clips,'boneCount':len(self.bones),'meshCount':len(self.meshes),'reviewViews':[v[0]+'.png' for v in views],'status':'authored-awaiting-runtime-visual-motion-review'}
        (self.folder/'manifest.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
        print('SHIRE_ASSET_READY '+json.dumps(metadata),flush=True)

for kind in selected:
    if kind not in KINDS:raise ValueError('Unknown entity '+kind)
    author=Author(kind)
    if kind in ['sheep','cattle','pig','horse','llama']:author.quadruped()
    elif kind in ['chicken','bird']:author.avian()
    elif kind in ['fish','frog']:author.aquatic()
    else:author.hobbit()
    author.rig();author.save()
