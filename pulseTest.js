const r =  require('dbConfig.js')
const  {CreateProposal, Support, pulseSupport, vote} = require('be')

const pulseTest = () => {
    var userlist = ['uri1','uri2','uri3','uri4','uri5','uri6'],
        Members = [],
        Proposals = [],
        Actions = [],
        Users= [],
        Statements = [],
        Kbz = ''

    return Promise.all(userlist.map((username) => { return CreateUser({user_name : username, email : username+"@gmail.com", image : "http://phootoos/"+username+".jpg",age :56})}))

    .then((users) => {
        Users = users
        return CreateKbz('users',3,"PULSEtestKBZ",[users[0].obj,users[1].obj,users[2].obj])
    })

    .then((kbz) => {
        Kbz = kbz.id
        console.log('createkbz: ',Kbz)
        return r.table(Kbz).filter(r.row('memberStatus').eq(1))
    })

    .then((members)=>{
        Members = members
        var p1 = CreateProposal(Kbz,null,"let me in user5","ME",Users[4].id,{parent : 'users',parent_member : Users[4].id, userObj : Users[4].obj}),
            p2 = CreateProposal(Kbz,null,"let me in user4","ME",Users[3].id,{parent : 'users',parent_member : Users[3].id, userObj : Users[3].obj}),
            p3 = CreateProposal(Kbz,Members[0].id,"holes in my head","NS",0,{statement : 'hey beenn trying to...'}),                
            p4 = CreateProposal(Kbz,Members[1].id,"freaky like that","CV",0,{variableName : 'Name', newValue : "la freak"}),
            p5 = CreateProposal(Kbz,Members[0].id,"lets doo some work!!","CA",0,{actionName : "FloosEveryMornuing"}),
            p6 = CreateProposal(Kbz,Members[0].id,"dont do nothing","CA",0,{actionName : "getitstaiot"})
            p7 = CreateProposal(Kbz,Members[0].id,"we are on it!","CA",0,{actionName : "fill it up"})            
            return Promise.all([p1,p2,p3,p4,p5,p6,p7])
    },(err)=> console.log("members err: ",err))

    .then((proposals)=>{
        Proposals = proposals
        console.log('Proposals: ',Proposals)
        var p1 = Support(Kbz,Proposals[0].id,Members[1].id),
            p2 = Support(Kbz,Proposals[0].id,Members[0].id),
            p3 = Support(Kbz,Proposals[2].id,Members[2].id),
            p4 = Support(Kbz,Proposals[2].id,Members[1].id),
            p5 = Support(Kbz,Proposals[1].id,Members[2].id),
            p6 = Support(Kbz,Proposals[4].id,Members[0].id),
            p7 = Support(Kbz,Proposals[5].id,Members[2].id),
            p8 = Support(Kbz,Proposals[3].id,Members[0].id)
        return Promise.all([p1,p2,p3,p4,p5,p6,p7,p8])
    },(err)=> console.log("proposals err: ",err))

    .then((x)=> {
        console.log("SUPPORT1:",x)
        var p1 = pulseSupport(Kbz,Members[1].id),
            p2 = pulseSupport(Kbz,Members[0].id)
        return Promise.all([p1,p2])
    },(err)=> console.log("first pulse err: ",err))

    .then((x)=>{
        console.log('pulseSupport: ',x)
        var p1 = vote(Kbz,Proposals[0].id,Members[1].id,1),
            p2 = vote(Kbz,Proposals[0].id,Members[0].id,1),
            p3 = vote(Kbz,Proposals[2].id,Members[2].id,1),
            p4 = vote(Kbz,Proposals[2].id,Members[1].id,1),
            p5 = vote(Kbz,Proposals[1].id,Members[2].id,1),
            p6 = vote(Kbz,Proposals[4].id,Members[0].id,1),
            p7 = vote(Kbz,Proposals[4].id,Members[2].id,1),
            p8 = vote(Kbz,Proposals[5].id,Members[0].id,1),
            p9 = vote(Kbz,Proposals[3].id,Members[0].id,1)                        
        return Promise.all([p1,p2,p3,p4,p5,p6,p7,p8,p9])
    },(err)=> console.log("first votes err: ",err))

    .then((x)=> {
        console.log("SUPPORT2:",x)
        var p1 = pulseSupport(Kbz,Members[1].id),
            p2 = pulseSupport(Kbz,Members[0].id)
        return Promise.all([p1,p2])//.then((x) =>console.log('pulseSupport: ',x))
    },(err)=> console.log("second pulse err: ",err))

    .then((x) => {
        console.log('pulseSupport: ',x)
        return r.table(Kbz).get('TheKbzDocument')('actions')('live').then((actions) => {
            console.log("Actions:::",actions);
           
            Actions = Object.keys(actions);
            return r.table(Kbz).filter({statementStatus : 1}).then((statements) => {
                console.log("Statements",statements);
                Statements = statements
                var p5 = CreateProposal(Kbz,Members[1].id,"replace this satateememenet",'RS',0,{statement : "with this one", statement_id : Statements[0].id}),
                    p1 = CreateProposal(Kbz,Members[2].id,"letmeinaction3",'AM',0,{action_id : Actions[0], member_id : Members[2].id, userObj : Members[2].userObj}),
                    p2 = CreateProposal(Kbz,Members[2].id,"letmeinaction2",'AM',0,{action_id : Actions[1], member_id : Members[2].id, userObj : Members[2].userObj}),
                    p3 = CreateProposal(Kbz,Members[0].id,"letmeinaction1",'AM',0,{action_id : Actions[0], member_id : Members[0].id, userObj : Members[0].userObj}),
                    p4 = CreateProposal(Kbz,Members[1].id,"letmeinaction4",'AM',0,{action_id : Actions[1], member_id : Members[1].id, userObj : Members[1].userObj})                     
                return Promise.all([p1,p2,p3,p4,p5])
        },(err)=> console.log("debug 1 second pulse err: ",err))
        },(err)=> console.log("debug 2 second pulse err: ",err))
    },(err)=> console.log("another proposals: ",err))


    .then((proposals)=>{ 
        Proposals = proposals
        console.log('Proposals3: ',Proposals)
        var p1 = Support(Kbz,Proposals[0].id,Members[1].id),
            p2 = Support(Kbz,Proposals[1].id,Members[0].id),
            p3 = Support(Kbz,Proposals[2].id,Members[2].id),
            p4 = Support(Kbz,Proposals[3].id,Members[1].id),
            p5 = Support(Kbz,Proposals[4].id,Members[2].id)
        return Promise.all([p1,p2,p3,p4,p5])
    },(err)=> console.log("proposals err: ",err))

    .then((x)=> {
        console.log("SUPPORT3:",x)
        var p1 = pulseSupport(Kbz,Members[1].id),
            p2 = pulseSupport(Kbz,Members[0].id)
        return Promise.all([p1,p2])
    },(err)=> console.log("third pulse err: ",err))

    .then((x)=>{
        console.log('pulseSupport3: ',x)
        var p1 = vote(Kbz,Proposals[0].id,Members[1].id,1),
            p2 = vote(Kbz,Proposals[1].id,Members[0].id,1),
            p3 = vote(Kbz,Proposals[2].id,Members[2].id,1),
            p4 = vote(Kbz,Proposals[3].id,Members[1].id,1),
            p5 = vote(Kbz,Proposals[4].id,Members[2].id,1),
            p6 = vote(Kbz,Proposals[1].id,Members[1].id,1),
            p7 = vote(Kbz,Proposals[2].id,Members[1].id,1),
            p8 = vote(Kbz,Proposals[3].id,Members[0].id,1),
            p9 = vote(Kbz,Proposals[4].id,Members[1].id,1),
            p10 = vote(Kbz,Proposals[0].id,Members[0].id,1)
        return Promise.all([p1,p2,p3,p4,p5,p6,p7,p8,p9,p10])
    },(err)=> console.log("first votes err: ",err))

    .then((x)=> {
        console.log("SUPPORT4:",x)
        var p1 = pulseSupport(Kbz,Members[1].id),
            p2 = pulseSupport(Kbz,Members[0].id)
           // p3 = pulseSupport(Kbz,Members[2].id)            
        return Promise.all([p1,p2])//.then((x) =>console.log('pulseSupport: ',x))
    },(err)=> console.log("fourth pulse err: ",err))

} 

pulseTest();
