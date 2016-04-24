/*-------DB Functions------*/

var r = require('rethinkdbdash')({
    port: 28015,
    host: 'localhost',
    db: 'Kibbutznik'
});

var randomKbzId = () => {
    var d = new Date().getTime();
    var uuid = 'KBZxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        return (c=='x' ? r : (r&0x3|0x8)).toString(16);
    });
    return uuid;
};

var CreateStatement = (KBZ, statement, proposal_id) => {
    if (!KBZ || !statement || !proposal_id) console.error("CreateStatement parameters are not soficient");
    var statement = {dtype : 'statement',
                    statement : statement,
                    StatementStatus : 1,    /*Need to add Index on StatementStatus*/
                    proposals : [proposal_id]
                    };
    return r.table(KBZ).insert(statement).run()
            .error((err) => {console.log("Error in CreateStatement",err)});
};


var CancelStatement = (KBZ,id) => {
    return r.table(KBZ).get(id).update({StatementStatus : 2}).run();
}

var ReplaceStatement = (KBZ,oldId,statement,proposal_id) =>{
    CancelStatement(KBZ,oldId)
    return CreateStatement(KBZ,statement,proposal_id);
}

var ReplaceVariable = (KBZ,variableName, newValue) => {
    return r.table(KBZ).get('variables')(variableName).run()
    .then((data)=>{
        data.value = newValue;
        return r.table(KBZ).get('variables').update(r.object(variableName, data)).run()
    })
}


var CreatePulse = (KBZ) =>{
    var pulse = {};
    pulse.PulseStatus = 1; 
    pulse.Assigned = [];
    pulse.OnTheAir = [];
    pulse.Approved = [];
    pulse.Rejected = [];
    return r.table(KBZ).insert(pulse).run()
            .then((data) => {
                r.table(KBZ)
                .get('TheKbzDocument')
                .update({'pulses' : {'Assigned': data.generated_keys[0]}}).run();
            return Promise.resolve(data)    
        })
        .error((err) => {console.log("Error in CreatePulse: ",err)});    
};


var CreateKbz = (PARENT, member_id, proposal_id, action_name, invitetions) => { 
    var kbz = {id : 'TheKbzDocument',
                parent : PARENT,
                actions : {
                    live: {},
                    past: {}
                    },
                kbzStatus : 1,
                size : 0,
                pulsesupport : {
                    members: [],
                    count: 0
                    },
                pulses : {
                    Assigned: null,
                    OnTheAir: null,
                    Past: []
                    },
            };
    var variables = {id : 'variables'};

        kbz.proposals = (proposal_id ? [proposal_id] : []);
        r.table('variables').run()
            .then((data) => {
                data.forEach((variable) => {
                    variables[variable.id] = {
                        desc : variable.desc,
                        name : variable.name,
                        value: (variable.id === 'Name' ? action_name || 'No Name' :  variable.value),
                        proposals : []
                    }
                });
        });    
        var tableName = randomKbzId();
        return r.tableCreate(tableName).run().then(()=>{
            return r.table(tableName).insert([kbz,variables]).run()
                .then(() => {
                    CreatePulse(tableName);
                    if (member_id) {
                        CreateMember(tableName, PARENT, member_id, proposal_id);
                    }

                    return tableName;
                });
        }).error((err) => {console.log("err in CreateKbz:",err)});        
};


var CreateMember = (KBZ, PARENT, parent_member, proposal_id,user_id) => {
    if (!KBZ) throw new Error ("CreateMember parameter FAIL!");
    var Member = {};
    Member.parent_member = parent_member;
    Member.PARENT = PARENT;
    Member.proposals = (proposal_id ? [proposal_id] : []);
    Member.user_id = (user_id ? user_id : parent_member);
    Member.memberships = {
        live : {},
        past : {}
    };
    Member.memberStatus = 1;
    console.log("in CreateMember:2",Member);
    return r.table(KBZ).insert(Member)
        .then((member) => {
            console.log("in CreateMember3:",member);
            return r.table(PARENT).get(parent_member)
             .update({memberships : {live : r.row('memberships')('live').merge(r.object(KBZ, member.generated_keys[0]))}}).run()
             .then(()=>{
                return r.table(KBZ).get('TheKbzDocument').update({size : r.row('size').add(1)}).run()
             }) 
        }).error((err) => {console.log("err in CreateMember:",err)})        
};

var CreateUser = (userObj) =>{
    userObj.memberships = {};
    return r.table('users').insert(userObj)
        //    confirmRegistration();
};


var RemoveMember = (KBZ, member_id,proposal_id) => {
    return r.table(KBZ).get(member_id).update(
        {
            memberStatus : 2,
            proposals : r.row('proposals').append(proposal_id)
        },{ returnChanges : true })
        .then((data) => {
            console.log(data);
            if (data.replaced === 0 ) return new Error("Thers no live member with the id:"+member_id);            
            var member = data.changes[0].new_val;
            console.log("In RemoveMember:", member);
            var p1 =  r.table(member.PARENT).get(member.parent_member).update(
                {
                    memberships : {live : r.literal(r.row('memberships')('live').without(KBZ))},
                    memberships : {past : r.row('memberships')('past').merge(r.object(KBZ,member.id))}
                }).run(),
                //p2 = r.table(member.PARENT).get(member.parent_member).update({memberships : {past : r.row('memberships')('past').merge(r.object(KBZ,member.id))}}).run();
            if (member.memberships.live === {}) return p1.then(()=>{return member});
            return Object.keys(member.memberships.live).forEach((son)=>{
                console.log("SON:",son)
                return RemoveMember(son, member.memberships.live[son])
                .then(data => {
                    return member
                })
            })
        })
}


var CreateAction = (PARENT, proposal_id, action_name) => {
    CreateKbz(PARENT, 0, proposal_id, action_name)
        .then((action_id) => {
            console.log('action_id',action_id);
            r.table(PARENT).get('TheKbzDocument').update({'actions' : {'live' : r.row('actions')('live').append(action_id)}}).run()
            .then(()=>{return action_id})
        }).error((err) => {console.log("err in CreateAction:",err)});
}


var RemoveMember = (ACTION,,proposal_id) => {
    return r.table(KBZ).get(member_id).update(
        {
            memberStatus : 2,
            proposals : r.row('proposals').append(proposal_id)
        },{ returnChanges : true })
        .then((data) => {
            console.log(data);
            if (data.replaced === 0 ) return new Error("Thers no live member with the id:"+member_id);            
            var member = data.changes[0].new_val;
            console.log("In RemoveMember:", member);
            var p1 =  r.table(member.PARENT).get(member.parent_member).update(
                {
                    memberships : {live : r.literal(r.row('memberships')('live').without(KBZ))},
                    memberships : {past : r.row('memberships')('past').merge(r.object(KBZ,member.id))}
                }).run(),
                //p2 = r.table(member.PARENT).get(member.parent_member).update({memberships : {past : r.row('memberships')('past').merge(r.object(KBZ,member.id))}}).run();
            if (member.memberships.live === {}) return p1.then(()=>{return member});
            return Object.keys(member.memberships.live).forEach((son)=>{
                console.log("SON:",son)
                return RemoveMember(son, member.memberships.live[son])
                .then(data => {
                    return member
                })
            })
        })
}

var CreateCommitteeMember = (ACTION, KBZ, member_id, proposal_id,user_id) => {
    console.log("In CreateCommitteeMember: ", ACTION, member_id, proposal_id);
    if (!ACTION || !KBZ) throw new Error("CreateCommitteeMember: no action");
    return CreateMember(ACTION,KBZ,member_id,proposal_id,user_id).error((err) => {console.log("err in CreateMember:",err)})
};

var InitiateVariables = () => {
 return r.table('variables').insert([{
        id :"PulseSupport",
            "type": "PUS",
            "name": "Pulse Support",
            "value": 50,
            "desc": "The precentage of members support nedded to execute a pulse.",
            "proposals": []
        },
        {id: "ProposalSupport",
            "type": "PS",
            "name": "Proposal Support",
            "value": 15,
            "desc": "The precentage of members support nedded to assiged a Proposal to a pulse.",
            "proposals": []
        },
        {id : "ChangeVariable" ,
            "type": "CV",
            "name": "Change Variable",
            "value": 50,
            "desc": "The precentage of members vote nedded for changing a Variable value.",
            "proposals": []
        },
        {id : "ME",
            "type": "ME",
            "name": "Membership",
            "value": 50,
            "desc": "The precentage of members vote nedded to grant Membership to a User.",
            "proposals": []
        },
        {id : "EM",
            "type": "EM",
            "name": "End Membership",
            "value": 60,
            "desc": "The precentage of members vote nedded to Revoke Membership to a User.",
            "proposals": []
        },
        {id : "NS",
            "type": "NS",
            "name": "New Statement",
            "value": 50,
            "desc": "The precentage of members vote nedded to accept a new Statement.",
            "proposals": []
        },
        {id : "CS",
            "type": "CS",
            "name": "Cancel Statement",
            "value": 60,
            "desc": "The precentage of members vote nedded to Cancel Statement.",
            "proposals": []
        },
        {id : "NA",
            "type": "NA",
            "name": "New Action",
            "value": 50,
            "desc": "The precentage of members vote nedded to accept a new Action.",
            "proposals": []
        },
        {id : "RS",
            "type": "RS",
            "name": "Replace Statement",
            "value": 60,
            "desc": "The precentage of members vote nedded to Replace Statement.",
            "proposals": []
        },
        {id : "CM",
            "type": "CM",
            "name": "Committee Member",
            "value": 50,
            "desc": "The precentage of members vote nedded for assigning a Member to an Action.",
            "proposals": []
        },
        {id : "MinCommittee",
            "type": "MinC",
            "name": "MinCommittee",
            "value": 2,
            "desc": "The Minimun size of an Action Committee.",
            "proposals": []
        },
        {id : "MaxAge",
            "type": "MaxAge",
            "name": "MaxAge",
            "value": 2,
            "desc": "The Maximim 'OutThere' Proposal Age (in Pulses).",
            "proposals": []
        },
        {id : "Name",
            "type": "Name",
            "name": "Name",
            "value": "No Name",
            "desc": "The Communitty Name.",
            "proposals": []
        },
        {id : "Status",
            "type": "Status",
            "name": "Status",
            "value": "Alive",
            "desc": "The Communitty Status.",
            "proposals": []
        }        
    ]).run()
}


// test function


var testStatement = (k) => {
    CreateStatement(k,"hel all",1).then((data)=>{
        ReplaceStatement(k,data.generated_keys[0],"hell fauck",2).then((da) => {
            CancelStatement(k,da.generated_keys[0]).then((d)=>{
                console.log('testStatement:', data,da,d);
            })
        })
    })    
}

//CreateKbz('users','78642460-3f7e-4e38-96ef-c9f8bb2ac0a6',3,'urisFirstKibbuts',[]).then((data)=>{console.log("kbz:",data)});
//CreateMember('KBZd651089ed4c8e987363d3dfc8385c','KBZbb2b7593b4d14af63d2b425502b99','e3e10417-e739-48f4-b365-cb5d42d34f0e',225,"e3e10417-e739-48f4-b365-cb5d42d34f0e");
//CreateUser({username : "uri2",email: "uri2@gmial.com"}).then((x)=>{console.log("good",x)}).error((x)=>{console.log("bad",x)});
//CreateAction('KBZbb2b7593b4d14af63d2b425502b99',190133,"FisreeetAction")
//CreateStatement('KBZ56a3acbb444cb9b9b61c800c2e5f3',"letterebelight",112233);
//ReplaceVariable('KBZe798d78114d9588e7e11660532221','CM',68);
RemoveMember('KBZbb2b7593b4d14af63d2b425502b99','e3e10417-e739-48f4-b365-cb5d42d34f0e').then((d)=>{console.log("dd:",d)});