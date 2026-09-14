// extension/content/workday-selectors.js
// Selector strings from docs/plans/2026-09-14-jobie-agent.md Appendix A. Fix mismatches here, one line each.
const WD = {
  pages: {
    applyButton: 'a[data-automation-id="adventureButton"]',
    applyManually: 'a[data-automation-id="applyManually"]',
    signInButton: 'button[data-automation-id="utilityButtonSignIn"]',
    signInEmail: 'input[data-automation-id="email"]',
    signInPassword: 'input[data-automation-id="password"]',
    signInSubmit: 'button[data-automation-id="signInSubmitButton"]',
    myInformation: 'div[data-automation-id="contactInformationPage"]',
    myExperience: 'div[data-automation-id="myExperiencePage"]',
    voluntaryDisclosures: 'div[data-automation-id="voluntaryDisclosuresPage"]',
    selfIdentification: 'div[data-automation-id="selfIdentificationPage"]',
    // UNVERIFIED: no dedicated container; detect by an h2 whose text contains "review"
    reviewHeading: "h2",
    // UNVERIFIED: the footer button keeps this id on every step, so on the Review page it is the Submit button
    nextButton: 'button[data-automation-id="bottom-navigation-next-button"], button[data-automation-id="pageFooterNextButton"]',
    // UNVERIFIED: inline field errors and the page-top banner Workday shows after a failed Save and Continue
    errorMessage: '[data-automation-id="errorMessage"], [data-automation-id="alertMessage"], [role="alert"]',
    // Verified on edftrading.wd1: search page with a details panel uses /details/, standalone postings use /job/
    postingUrlPattern: /\/(job|details)\//,
  },
  posting: {
    title: { tryFirst: '[data-automation-id="jobPostingHeader"]', fallback: "h1" },
    description: { tryFirst: '[data-automation-id="jobPostingDescription"]', fallback: "main" },
    location: { tryFirst: '[data-automation-id="jobDetails"] [data-automation-id="locations"]', fallback: '[data-automation-id="locations"]' },
  },
  fields: {
    firstName: 'input[data-automation-id="legalNameSection_firstName"]',
    lastName: 'input[data-automation-id="legalNameSection_lastName"]',
    // UNVERIFIED: Appendix A has no My Information email selector (only the sign-in page has one)
    email: 'input[data-automation-id="email"]',
    addressLine1: 'input[data-automation-id="addressSection_addressLine1"]',
    city: 'input[data-automation-id="addressSection_city"]',
    postalCode: 'input[data-automation-id="addressSection_postalCode"]',
    country: 'button[data-automation-id="addressSection_countryRegion"]',
    phoneType: 'button[data-automation-id="phone-device-type"]',
    phoneNumber: 'input[data-automation-id="phone-number"]',
    fileUploadInput: 'input[data-automation-id="file-upload-input-ref"]',
    fileUploadDropZone: '[data-automation-id="file-upload-drop-zone"]',
    fileUploadSuccess: '[data-automation-id="file-upload-successful"]',
    // UNVERIFIED: no source lists a Workday cover letter field; guessed for parity with the fake page
    coverLetterTextarea: 'textarea[data-automation-id="coverLetter"]',
    linkedin: 'input[data-automation-id="linkedinQuestion"]',
    website: 'div[data-automation-id^="websitePanelSet-"] input',
    howDidYouHear: 'div[data-automation-id="formField-sourcePrompt"], div[data-automation-id="formField-source"]',
    workExperienceSection: 'div[data-automation-id="workExperienceSection"]',
    skills: 'div[data-automation-id="formField-skills"] [data-automation-id="monikerSearchBox"]',
    gender: 'button[data-automation-id="gender"]',
    hispanicOrLatino: 'button[data-automation-id="hispanicOrLatino"]',
    ethnicity: 'button[data-automation-id="ethnicityDropdown"]',
    veteranStatus: 'button[data-automation-id="veteranStatus"]',
    consentCheckbox: 'input[data-automation-id="agreementCheckbox"]',
  },
  widgets: {
    dropdownButton: 'button[aria-haspopup="listbox"]',
    dropdownPopup: '[data-automation-widget="wd-popup"]',
    dropdownOption: "li",
  },
};
