// Live CTSO membership stays in the original Trip-o-Meter; no snapshot is imported.
const ROBOTICS_POW='1Mzxf0q87UHCQ5R6L0IBl2uCO_TmH-TmdcRSDIxOmBgw';
function roboticsAccess_(identity,leaders){
 if(OWNER_EMAILS.includes(email_(identity)))return true;
 const address=memberEmail_(identity,'CTSO');
 if(!rows_('CTSO').some(row=>email_(row[1])===address))return false;
 const roles=leaders||nestAccessValues_(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[];
 return roles.some(row=>String(row[0]||'').replace(/period/ig,'').trim().toUpperCase()==='CTSO'&&email_(row[4])===address&&
  /^chief (executive|financial|operations) officers?$/i.test(String(row[2]||'').trim()));
}
function roboticsName_(value){
 const name=String(value||'').trim(),parts=name.split(',');
 return (parts.length>1?parts.slice(1).join(' ')+' '+parts[0]:name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
}
function roboticsValues_(id,range){return Sheets.Spreadsheets.Values.get(id,range,{valueRenderOption:'UNFORMATTED_VALUE'}).values||[];}
function roboticsState_(){
 const id=PERIODS.CTSO,roster=rows_('CTSO');
 const membership=roboticsValues_(id,"'NEST™MembershipStatus'!A3:E1000"),raw=roboticsValues_(id,"'FRC Roster Raw'!A2:E1000");
 const pow=roboticsValues_(ROBOTICS_POW,"'MembershipForm'!A2:E1000");
 const members=membership.map((row,index)=>{
  if(!row[2])return null;
  const candidates=roster.filter(person=>roboticsName_(person[0])===roboticsName_(row[2]));
  const matched=candidates.length===1?candidates[0]:null,studentId=String(row[3]||'').trim();
  // ID and email inconsistencies are visible and excluded from reminder delivery.
  const email=matched?email_(matched[1]):'',identityVerified=!!email&&studentId&&email===studentId+'@students.bethelsd.org';
  const accepted=raw.filter(record=>record[0]&&((record[4]&&email_(record[4])===email)||roboticsName_(record[3]||record[0])===roboticsName_(row[2])));
  const powMatches=pow.map((record,i)=>({record,row:i+2})).filter(item=>String(item.record[3]||'').trim()===studentId&&roboticsName_(item.record[2])===roboticsName_(row[2]));
  return {id:hash_(studentId+'|'+roboticsName_(row[2])),row:index+3,name:String(row[2]),studentId,email,active:row[0]===true,inactive:row[1]===true,
   joined:accepted.length===1,waiver:accepted.length===1?(['YES','NO'].includes(String(accepted[0][1]).toUpperCase())?String(accepted[0][1]).toUpperCase()==='YES':null):null,
   identityVerified,firstAmbiguous:accepted.length>1,powRow:powMatches.length===1?powMatches[0].row:null,
   warning:accepted.length>1?'Multiple FIRST records need review':!matched?'Not uniquely matched to the CTSO roster':!identityVerified?'Student ID and roster email need review':powMatches.length!==1?'Program of Work record needs review':''};
 }).filter(Boolean);
 if(new Set(members.map(member=>member.id)).size!==members.length)throw new Error('Duplicate membership IDs');
 const revision=hash_(JSON.stringify({membership,raw,pow,roster}));
 return {membership,raw,pow,members,revision};
}
function roboticsView_(state){
 const members=state.members.map(({row,powRow,...member})=>({...member,canChangeStatus:!!powRow}));
 const current=members.filter(member=>member.active);
 return {status:200,revision:state.revision,members,summary:{active:current.length,joined:current.filter(m=>m.joined).length,waivers:current.filter(m=>m.waiver===true).length,
  needJoin:current.filter(m=>!m.joined).length,needWaiver:current.filter(m=>m.joined&&!m.waiver).length},
  importedAt:PropertiesService.getScriptProperties().getProperty('robotics-imported-at')||null,
  unmatched:state.raw.filter(row=>row[0]&&!members.some(m=>roboticsName_(m.name)===roboticsName_(row[3]||row[0]))).map(row=>String(row[0]))};
}
function roboticsWrite_(id,data){if(data.length)Sheets.Spreadsheets.Values.batchUpdate({valueInputOption:'RAW',data},id);}
function roboticsSummary_(state){
 const members=state.members.filter(m=>m.email),view=roboticsView_(state),s=view.summary;
 const rows=members.map(m=>[m.name,m.joined?'✅':'🚫',m.joined?(m.waiver?'✅':'🚫'):'N/A']);
 const count=Math.max(rows.length,state.membership.length,1);
 roboticsWrite_(PERIODS.CTSO,[{range:"'NEST™MembershipStatus'!H1:J"+(count+1),values:[['Member','FRC Membership','Parent waiver signed'],...Array.from({length:count},(_,i)=>rows[i]||['','',''])]},
  {range:"'NEST™MembershipStatus'!L1:M5",values:[['Total Students in Club:',s.active],['Total on FRC Roster:',s.joined],['Total with Parent Waiver:',s.waivers],['Students Need to Join FRC:',members.filter(m=>m.active&&!m.joined).map(m=>m.name).join(' | ')],['Students Need Parent Waiver:',members.filter(m=>m.active&&m.joined&&!m.waiver).map(m=>m.name).join(' | ')]]}]);
}
function roboticsRefresh_(state){
 // POW owns membership, exactly as in the original Refresh from Program of Work.
 const valid=state.pow.filter(row=>row[2]);
 if(!valid.length)return {status:409};
 const rows=Array.from({length:Math.max(valid.length,state.membership.length)},(_,i)=>valid[i]?Array.from({length:5},(_,j)=>valid[i][j]??''):['','','','','']);
 roboticsWrite_(PERIODS.CTSO,[{range:"'NEST™MembershipStatus'!A3:E"+(rows.length+2),values:rows}]);
 const fresh=roboticsState_();roboticsSummary_(fresh);return roboticsView_(fresh);
}
function roboticsImport_(r,state){
 const parsed=TripOMeter_parseAcceptedYouth_(TripOMeter_prepareRosterLines_(r.text));
 if(!parsed.length||parsed.length>999)return {status:400};
 const rows=parsed.map(person=>{
  const matches=state.members.filter(m=>person.email&&email_(person.email)===m.email||roboticsName_(person.name)===roboticsName_(m.name));
  const matched=matches.length===1?matches[0]:null;
  return [person.name,person.consentSigned?'YES':person.foundConsent?'NO':'UNKNOWN',matched?'✅':'❌',matched?matched.name:'No match',person.email||''];
 });
 const count=Math.max(rows.length,state.raw.length),values=Array.from({length:count},(_,i)=>rows[i]||['','','','','']);
 roboticsWrite_(PERIODS.CTSO,[{range:"'FRC Roster Raw'!A1:E"+(count+1),values:[['Student Name (from Roster)','Consent Signed?','Matched to CTSO?','CTSO Name','FIRST email'],...values]}]);
 PropertiesService.getScriptProperties().setProperty('robotics-imported-at',new Date().toISOString());
 const fresh=roboticsState_();roboticsSummary_(fresh);return roboticsView_(fresh);
}
function roboticsMessage_(name,kind){
 const first=String(name).includes(',')?String(name).split(',').slice(1).join(' ').trim():String(name).split(/\s+/)[0];
 const join=kind==='join';
 const subject=join?'NEST™ Robotics - Please Register for FRC Team #2927':'NEST™ Robotics - Parent Waiver Form Needed';
 const body='Hi '+first+'!\n\n'+(join?'To participate in FIRST Robotics Competition this season, create or sign in to your FIRST account, search for Team #2927 (NEST™ Robotics), and request to join.':'Your parent or guardian needs to complete the electronic FIRST consent and release form for you to participate in FRC events.')+'\n\nhttps://my.firstinspires.org/Dashboard/\n\nPlease contact Mr. Peñalver if you need help.\nNEST™ Robotics #2927';
 return {subject,body};
}
function roboticsRecipients_(state,kind,session){
 if(kind==='test')return [{id:hash_(session.email),name:'Mario / executive test',email:email_(session.email),kind:'join'},{id:hash_(session.email),name:'Mario / executive test',email:email_(session.email),kind:'waiver'}].filter(m=>!m.email.startsWith('manual:'));
 return state.members.filter(m=>m.active&&m.identityVerified&&!m.firstAmbiguous).flatMap(m=>!m.joined&&['join','both'].includes(kind)?[{id:m.id,name:m.name,email:m.email,kind:'join'}]:m.joined&&m.waiver===false&&['waiver','both'].includes(kind)?[{id:m.id,name:m.name,email:m.email,kind:'waiver'}]:[]);
}
function roboticsNotify_(r,state,session,store){
 const now=Date.now();
 if(r.operation==='preview'){
  if(!['join','waiver','both','test'].includes(r.kind))return {status:400};
  // Expire old preview records to keep Script Properties bounded.
  Object.keys(store.getProperties()).filter(key=>key.startsWith('robotics-mail:')).forEach(key=>{const record=JSON.parse(store.getProperty(key));if(record.expires<now)store.deleteProperty(key);});
  const recipients=roboticsRecipients_(state,r.kind,session),ticket=Utilities.getUuid();
  store.setProperty('robotics-mail:'+ticket,JSON.stringify({actor:hash_(session.email),revision:state.revision,kind:r.kind,expires:now+600000,used:false}));
  return {status:200,ticket,recipients,skipped:state.members.filter(m=>m.active&&(!m.identityVerified||m.firstAmbiguous)).map(m=>m.name),messages:['join','waiver'].filter(kind=>recipients.some(m=>m.kind===kind)).map(kind=>({kind,...roboticsMessage_('Team member',kind)}))};
 }
 const key='robotics-mail:'+r.ticket,raw=store.getProperty(key);if(!raw)return {status:409};
 const plan=JSON.parse(raw);
 if(plan.actor!==hash_(session.email)||plan.expires<now)return {status:409};
 if(plan.used)return {status:200,delivery:plan.delivery||'unknown',sent:plan.sent||0,failed:plan.failed||0};
 if(plan.revision!==state.revision)return {status:409};
 const recipients=roboticsRecipients_(state,plan.kind,session);
 if(recipients.length>MailApp.getRemainingDailyQuota())return {status:429};
 // Claim before sending: network retries must never deliver a duplicate batch.
 plan.used=true;plan.delivery='unknown';plan.sent=0;plan.failed=0;store.setProperty(key,JSON.stringify(plan));
 recipients.forEach(member=>{try{const message=roboticsMessage_(member.name,member.kind);MailApp.sendEmail({to:member.email,name:'NEST™ Robotics',subject:message.subject,body:message.body,htmlBody:roboticsMailHtml_(message)});plan.sent++;}catch(_){plan.failed++;}store.setProperty(key,JSON.stringify(plan));});
 plan.delivery=plan.failed?'partial':'sent';store.setProperty(key,JSON.stringify(plan));return {status:200,delivery:plan.delivery,sent:plan.sent,failed:plan.failed};
}
function roboticsDispatch_(r){
 const store=PropertiesService.getScriptProperties(),session=authSession_(r.session,store,Date.now());
 if(!session)return {status:401};if(!roboticsAccess_(session.email))return {status:403};
 if(!['view','status','refresh','import','preview','send'].includes(r.operation))return {status:400};
 const state=roboticsState_();if(r.operation==='view')return roboticsView_(state);
 if(['preview','send'].includes(r.operation))return roboticsNotify_(r,state,session,store);
 if(r.revision!==state.revision)return {status:409};
 if(r.operation==='refresh')return roboticsRefresh_(state);
 if(r.operation==='import'){try{return roboticsImport_(r,state);}catch(error){if(/Youth Members|Accepted|youth members|accepted/.test(error.message))return {status:400};throw error;}}
 const member=state.members.find(m=>m.id===r.member);
 if(!member||!member.powRow||typeof r.active!=='boolean')return {status:400};
 const values=[[r.active,!r.active]];
 // Write POW first. If the local write fails, Refresh from POW completes reconciliation.
 roboticsWrite_(ROBOTICS_POW,[{range:"'MembershipForm'!A"+member.powRow+':B'+member.powRow,values}]);
 roboticsWrite_(PERIODS.CTSO,[{range:"'NEST™MembershipStatus'!A"+member.row+':B'+member.row,values}]);
 const fresh=roboticsState_();roboticsSummary_(fresh);return roboticsView_(fresh);
}

// FIRST Dashboard parser supplied with the original Trip-o-Meter.
function TripOMeter_prepareRosterLines_(
  pastedText
) {

  return String(
    pastedText || ''
  )
    .replace(/\r\n?/g, '\n')
    .replace(/&#x20;|&#32;|&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .split('\n')
    .map(
      line =>
        String(line || '')
          .replace(/\s+/g, ' ')
          .trim()
    )
    .filter(Boolean);
}


/**
 * Parse only Youth Members > Accepted from the current FIRST Dashboard.
 */
function TripOMeter_parseAcceptedYouth_(
  lines
) {

  const normalized =
    lines.map(
      TripOMeter_normalizeRosterLabel_
    );

  const youthStart =
    normalized.findIndex(
      value =>
        value === 'youth members'
    );

  if (
    youthStart === -1
  ) {

    throw new Error(
      'The Youth Members section was not found in the pasted FIRST Dashboard text.'
    );
  }

  let youthEnd =
    normalized.findIndex(
      (value, index) =>
        index > youthStart &&
        value === 'team leadership'
    );

  if (
    youthEnd === -1
  ) {

    youthEnd =
      lines.length;
  }

  let acceptedStart =
    -1;

  for (
    let i = youthStart + 1;
    i < youthEnd;
    i++
  ) {

    if (
      normalized[i] === 'accepted'
    ) {

      acceptedStart =
        i;

      break;
    }
  }

  if (
    acceptedStart === -1
  ) {

    throw new Error(
      'The Accepted subsection was not found under Youth Members.'
    );
  }

  const acceptedEndLabels =
    new Set([
      'declined',
      'parent guardian invitation',
      'team leadership'
    ]);

  let acceptedEnd =
    youthEnd;

  for (
    let i = acceptedStart + 1;
    i < youthEnd;
    i++
  ) {

    if (
      acceptedEndLabels.has(
        normalized[i]
      )
    ) {

      acceptedEnd =
        i;

      break;
    }
  }

  const acceptedLines =
    lines.slice(
      acceptedStart + 1,
      acceptedEnd
    );

  const acceptedNormalized =
    acceptedLines.map(
      TripOMeter_normalizeRosterLabel_
    );

  const students =
    [];

  for (
    let i = 0;
    i < acceptedLines.length;
    i++
  ) {

    if (
      acceptedNormalized[i] !==
      'full legal name'
    ) {
      continue;
    }

    const name =
      String(
        acceptedLines[i + 1] || ''
      ).trim();

    if (
      !name ||
      TripOMeter_isRosterFieldLabel_(
        name
      )
    ) {
      continue;
    }

    let blockEnd =
      acceptedLines.length;

    for (
      let j = i + 2;
      j < acceptedLines.length;
      j++
    ) {

      if (
        acceptedNormalized[j] ===
        'full legal name'
      ) {

        blockEnd =
          j;

        break;
      }
    }

    const block =
      acceptedLines.slice(
        i,
        blockEnd
      );

    const blockNormalized =
      block.map(
        TripOMeter_normalizeRosterLabel_
      );

    let email =
      '';

    const emailLabelIndex =
      blockNormalized.findIndex(
        value =>
          value === 'email address'
      );

    if (
      emailLabelIndex !== -1 &&
      emailLabelIndex + 1 < block.length
    ) {

      const possibleEmail =
        String(
          block[emailLabelIndex + 1] || ''
        )
          .replace(/\\@/g, '@')
          .trim();

      if (
        possibleEmail.includes('@')
      ) {

        email =
          possibleEmail;
      }
    }

    const consentLine =
      block.find(
        line =>
          /consent\s*&\s*release/i.test(
            line
          )
      ) || '';

    const foundConsent =
      Boolean(
        consentLine
      );

    const consentSigned =
      /consent\s*&\s*release\s+is\s+on\s+record/i.test(
        consentLine
      ) &&
      !/not\s+on\s+record/i.test(
        consentLine
      );

    students.push({
      name:
        name,

      email:
        email,

      consentSigned:
        consentSigned,

      foundConsent:
        foundConsent
    });

    i =
      blockEnd - 1;
  }

  // De-duplicate in case browser selection repeats a rendered record.
  const unique =
    new Map();

  students.forEach(
    student => {

      const key =
        TripOMeter_normalizeName_(
          student.name
        ) +
        '|' +
        String(
          student.email || ''
        )
          .toLowerCase()
          .trim();

      if (
        !unique.has(key)
      ) {

        unique.set(
          key,
          student
        );
      }
    }
  );

  return Array.from(
    unique.values()
  );
}


function TripOMeter_normalizeRosterLabel_(
  value
) {

  return String(
    value || ''
  )
    .toLowerCase()
    .replace(/&#x20;|&#32;|&nbsp;/gi, ' ')
    .replace(/[+−–—]/g, ' ')
    .replace(/[:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}


function TripOMeter_isRosterFieldLabel_(
  value
) {

  return new Set([
    'full legal name',
    'email address',
    'phone number',
    'options',
    'parent/guardian name',
    'parent email',
    'parent phone number',
    'include in team roster printout',
    'designated award submitter'
  ]).has(
    TripOMeter_normalizeRosterLabel_(
      value
    )
  );
}


// ============================================================================
// SECTION 17 — REFRESH FRC STATUS FROM SAVED RAW ROSTER
// ============================================================================
//
// HEADLESS SAFE.
//
// This function contains no UI calls so it can run from scheduled triggers.
//
// ============================================================================


function TripOMeter_normalizeName_(
  value
) {

  return String(
    value || ''
  )
    .toLowerCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /[^a-z0-9]/g,
      ''
    );
}




function roboticsMailHtml_(message){
 const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 return '<div style="max-width:600px;margin:auto;font-family:Arial,sans-serif"><img src="https://gknest.org/assets/nest-email-banner.png" width="600" alt="NEST Robotics" style="max-width:100%;height:auto"><div style="padding:24px"><h2>'+escape(message.subject)+'</h2><p>'+escape(message.body).replace(/\n/g,'<br>')+'</p><p><a href="https://my.firstinspires.org/Dashboard/">Open FIRST Dashboard</a></p></div></div>';
}
