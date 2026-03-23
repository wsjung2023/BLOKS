// CharacterActivityStatus and CharacterType enums — runtime character states (doc 03, 04)
export enum CharacterActivityStatus {
  Idle = "Idle",
  Moving = "Moving",
  Focused = "Focused",
  Collaborating = "Collaborating",
  InMeeting = "InMeeting",
  Reviewing = "Reviewing",
  Escalating = "Escalating",
  Overloaded = "Overloaded",
  Resting = "Resting",
  Offline = "Offline",
}

export enum CharacterType {
  FounderAvatar = "FounderAvatar",
  DigitalTwin = "DigitalTwin",
  Executive = "Executive",
  Staff = "Staff",
  Specialist = "Specialist",
}

/** Active participation mode — controls render and AI scheduling (doc 04 section 3.6) */
export enum ActiveMode {
  ActiveCore = "ActiveCore",
  OnCall = "OnCall",
  Specialist = "Specialist",
  Dormant = "Dormant",
}

/** Org division family — doc 11 P0 fix #3 adds management */
export enum RoleFamilyType {
  executive = "executive",
  management = "management",
  strategy = "strategy",
  marketing = "marketing",
  research = "research",
  engineering = "engineering",
  operations = "operations",
}
