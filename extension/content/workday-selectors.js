// extension/content/workday-selectors.js
// Selector strings, one line each. "verified" means read from the live edftrading.wd1 tenant; the rest come from
// open-source fillers and stay as fallbacks for tenants on Workday's older form markup.
const WD = {
  pages: {
    applyButton: 'a[data-automation-id="adventureButton"]',
    applyManually: 'a[data-automation-id="applyManually"]',
    signInButton: 'button[data-automation-id="utilityButtonSignIn"]',
    signInEmail: 'input[data-automation-id="email"]',
    signInPassword: 'input[data-automation-id="password"]',
    signInSubmit: 'button[data-automation-id="signInSubmitButton"]',
    // verified: every apply page carries the progress bar; the active item's text reads "current step 1 of 5My Information"
    progressStep: '[data-automation-id="progressBarActiveStep"]',
    signIn: '[data-automation-id="signInContent"]',
    myInformation: 'div[data-automation-id="applyFlowMyInfoPage"], div[data-automation-id="contactInformationPage"]',
    myExperience: 'div[data-automation-id="myExperiencePage"]',
    voluntaryDisclosures: 'div[data-automation-id="voluntaryDisclosuresPage"]',
    selfIdentification: 'div[data-automation-id="selfIdentificationPage"]',
    reviewHeading: "h2",
    // verified: pageFooterNextButton reads "Save and Continue" and keeps its id on every step, so on Review it is Submit
    nextButton: 'button[data-automation-id="bottom-navigation-next-button"], button[data-automation-id="pageFooterNextButton"]',
    // verified on edftrading.wd1: role=alert also carries "successfully uploaded" notices, so errors come from Workday's own error ids
    errorMessage: '[data-automation-id="errorMessage"], [data-automation-id="alertMessage"], [data-automation-id="errorHeading"]',
    // verified: search page with a details panel uses /details/, standalone postings use /job/; apply pages keep /job/ too
    postingUrlPattern: /\/(job|details)\//,
  },
  posting: {
    title: { tryFirst: '[data-automation-id="jobPostingHeader"]', fallback: "h1" },
    description: { tryFirst: '[data-automation-id="jobPostingDescription"]', fallback: "main" },
    location: { tryFirst: '[data-automation-id="jobDetails"] [data-automation-id="locations"]', fallback: '[data-automation-id="locations"]' },
  },
  fields: {
    // verified: each control sits in a [data-automation-id="formField-<name>"] wrapper and carries no automation id itself
    firstName: '[data-automation-id="formField-legalName--firstName"] input, input[data-automation-id="legalNameSection_firstName"]',
    lastName: '[data-automation-id="formField-legalName--lastName"] input, input[data-automation-id="legalNameSection_lastName"]',
    email: '[data-automation-id="formField-email"] input, input[data-automation-id="email"]',
    addressLine1: '[data-automation-id="formField-addressLine1"] input, input[data-automation-id="addressSection_addressLine1"]',
    city: '[data-automation-id="formField-city"] input, input[data-automation-id="addressSection_city"]',
    postalCode: '[data-automation-id="formField-postalCode"] input, input[data-automation-id="addressSection_postalCode"]',
    country: '[data-automation-id="formField-country"] button, button[data-automation-id="addressSection_countryRegion"]',
    phoneType: '[data-automation-id="formField-phoneType"] button, button[data-automation-id="phone-device-type"]',
    countryPhoneCode: '[data-automation-id="formField-countryPhoneCode"] input',
    phoneNumber: '[data-automation-id="formField-phoneNumber"] input, input[data-automation-id="phone-number"]',
    fileUploadInput: 'input[data-automation-id="file-upload-input-ref"]',
    fileUploadDropZone: '[data-automation-id="file-upload-drop-zone"]',
    fileUploadSuccess: '[data-automation-id="file-upload-successful"]',
    coverLetterTextarea: 'textarea[data-automation-id="coverLetter"]',
    // verified on edftrading.wd1 15-Sep: the My Experience LinkedIn box sits in formField-linkedInAccount
    linkedin: '[data-automation-id="formField-linkedInAccount"] input, input[data-automation-id="linkedinQuestion"]',
    website: 'div[data-automation-id^="websitePanelSet-"] input',
    howDidYouHear: '[data-automation-id="formField-source"] input, div[data-automation-id="formField-sourcePrompt"] input',
    workExperienceSection: 'div[data-automation-id="workExperienceSection"]',
    skills: 'div[data-automation-id="formField-skills"] [data-automation-id="monikerSearchBox"]',
    gender: 'button[data-automation-id="gender"]',
    hispanicOrLatino: 'button[data-automation-id="hispanicOrLatino"]',
    ethnicity: 'button[data-automation-id="ethnicityDropdown"]',
    veteranStatus: 'button[data-automation-id="veteranStatus"]',
    consentCheckbox: 'input[data-automation-id="agreementCheckbox"]',
  },
  widgets: {
    formField: '[data-automation-id^="formField-"]',
    // verified: a required label ends in <abbr>*</abbr>
    required: "abbr",
    dropdownButton: 'button[aria-haspopup="listbox"]',
    dropdownList: 'ul[role="listbox"]',
    dropdownOption: "li",
    // verified: a search box's chosen value shows as a selectedItem inside a selectedItemList, itself a listbox
    selectedItemList: '[data-automation-id="selectedItemList"]',
    selectedItem: '[data-automation-id="selectedItem"]',
    promptOption: '[data-automation-id="promptOption"]',
  },
};
