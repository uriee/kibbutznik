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

var CreateStatement = (KBZ, value, proposal_id) => {
    if (!KBZ || !value || !proposal_id) console.error("CreateStatement parameters are not soficient");
    var statement = {dtype : 'statement',
                    statement : value,
                    StatemntStatus : 1,    /*Need to add Index on StatemntStatus*/
                    proposals : [proposal_id]
                    };
    return r.table(KBZ).insert(statement).run()
            .error((err) => {console.log("Error in CreateStatement",err)});
};


var CreatePulse = (KBZ) =>{
    var pulse = {};
    pulse.PulseStatus = 1; 
    pulse.Assigned = [];
    pulse.OnTheAir = [];
    pulse.Approved = [];
    pulse.Rejected = [];
    return r.table(KBZ).insert(pulse).run()
            .then((data) => {
                return
                r.table(KBZ)
                .get('TheKbzDocument')
                .update({'pulses' : {'Assigned': data.generated_keys[0]}}).run()
        })
        .error((err) => {console.log("Error in CreatePulse: ",err)});    
};

var CreateKbz = (PARENT, member_id, proposal_id, action_name, invitetions) => { /*need to implement invetations*/
    var kbz = {id : 'TheKbzDocument',
                parent : PARENT,
                actions : {
                    live: [],
                    past: []
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
                variables : {}    
            };
            kbz.proposals = (proposal_id ? [proposal_id] : []);
            r.table('variables').run()
                .then((data) => {
                    data.forEach((variable) => {
                        kbz.variables[variable.id] = {
                            desc : variable.desc,
                            name : variable.name,
                            value: (variable.id = 'name' ? action_name || 'No Name' :  variable.value),
                            proposals : []
                        }
                    });
            });    
            var tableName = randomKbzId();
            return r.tableCreate(tableName).run().then(()=>{
                return r.table(tableName).insert(kbz).run()
                    .then((newkbz) => {
                        CreatePulse(tableName);
                        if (member_id) {
                            CreateMember(tableName, PARENT, member_id, proposal_id);
                        }
                        return newkbz;
                    });
            }).error((err) => {console.log("err in CreateKbz:",err)});        
};

CreateKbz('users','78642460-3f7e-4e38-96ef-c9f8bb2ac0a6',3,'urisFirstKibbuts',[]).then((data)=>{console.log("finaldata:",data)});

var CreateMember = (KBZ, PARENT, parent_member, proposal_id,user_id) => {
    if (!KBZ) throw "CreateMember parameter FAIL!";
    var Member = {};
    Member.parent_member = parent_member;
    Member.PARENT = PARENT;
    Member.proposals = (proposal_id ? [proposal_id] : []);
    Member.user_id = (user_id ? user_id : parent_member);
    Member.actions = {
        live: [],
        past: []
    };
    Member.memberStatus = 1;
    console.log("in CreateMember:2",Member);
    return r.table(KBZ).insert(Member)
        .then((member) => {
            console.log("in CreateMember3:",member);
            r.table(PARENT).get(parent_member)('memberships').append([KBZ,member.generated_keys[0]]).run()
            .then(()=> {r.table(KBZ).get('TheKbzDocument')('size').add(1)
        });
    }).error((err) => {console.log("err in CreateMember:",err)})        
};

var createUser = (userObj) =>{
    userObj.memberships = [];
    return r.table('users').insert(userObj)
        //    confirmRegistration();
};

//createUser({username : "uri2",email: "uri2@gmial.com"}).then((x)=>{console.log("good",x)}).error((x)=>{console.log("bad",x)});


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


