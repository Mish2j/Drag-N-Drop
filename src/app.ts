interface Validatable {
  value: string | number;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  max?: number;
  min?: number;
}

interface Draggable {
  element: HTMLElement;

  dragStartHandler(event: DragEvent): void;
  dragEndHandler(event: DragEvent): void;
}

interface DragTarget {
  dragOverHandler(event: DragEvent): void;
  dropHandler(event: DragEvent): void;
  dragLeaveHandler(event: DragEvent): void;
}

enum ProjectStatus {
  Active,
  Finished,
}

class Project {
  constructor(
    public id: string,
    public title: string,
    public description: string,
    public people: number,
    public status: ProjectStatus
  ) {}
}

type Listener = (items: Project[]) => void;

// State Management
class ProjectState {
  private listeners: Listener[] = [];
  private projects: Project[] = [];
  private static instance: ProjectState;

  private constructor() {}

  static getInstance() {
    if (this.instance) {
      return this.instance;
    }
    this.instance = new ProjectState();
    return this.instance;
  }

  addProject(title: string, description: string, numOfPeople: number) {
    const newProject = new Project(
      Math.random().toString(),
      title,
      description,
      numOfPeople,
      ProjectStatus.Active
    );
    this.projects.push(newProject);
    this.updateListeners();
  }

  moveProject(projectId: string, newStatus: ProjectStatus) {
    const project = this.projects.find((proj) => proj.id === projectId);

    if (project && project.status !== newStatus) {
      project.status = newStatus;
      this.updateListeners();
    }
  }

  private updateListeners() {
    for (const listenerFn of this.listeners) {
      listenerFn(this.projects.slice());
    }
  }

  addListener(listenerFn: Listener) {
    this.listeners.push(listenerFn);
  }
}

abstract class Component<T extends HTMLElement, U extends HTMLElement> {
  templateElement: HTMLTemplateElement;
  hostElement: T;
  element: U;

  constructor(
    templateId: string,
    hostElementId: string,
    insertWhere: InsertPosition,
    newElementId?: string
  ) {
    this.templateElement = document.getElementById(
      templateId
    )! as HTMLTemplateElement;
    this.hostElement = document.getElementById(hostElementId)! as T;

    const importedNode = document.importNode(
      this.templateElement.content,
      true
    );

    this.element = importedNode.firstElementChild as U;

    if (newElementId) {
      this.element.id = newElementId;
    }

    this.render(insertWhere);
  }

  private render(insertWhere: InsertPosition) {
    this.hostElement.insertAdjacentElement(insertWhere, this.element);
  }

  abstract configure(): void;
  abstract renderContent(): void;
}

class ProjectItem
  extends Component<HTMLUListElement, HTMLLIElement>
  implements Draggable
{
  private project: Project;

  private get persons() {
    return this.project.people === 1
      ? "1 person"
      : `${this.project.people} persons`;
  }

  constructor(hostId: string, project: Project) {
    super("single-project", hostId, "afterbegin", project.id);
    this.project = project;

    this.configure();
    this.renderContent();
  }

  dragStartHandler(event: DragEvent) {
    event.dataTransfer!.setData("text/plain", this.project.id);
    event.dataTransfer!.effectAllowed = "move";
  }

  dragEndHandler(_: DragEvent) {}

  configure() {
    this.element.addEventListener(
      "dragstart",
      this.dragStartHandler.bind(this)
    );
    this.element.addEventListener("dragend", this.dragStartHandler.bind(this));
  }

  renderContent() {
    const { title, description } = this.project;
    this.element.querySelector("h2")!.textContent = title;
    this.element.querySelector("h3")!.textContent = this.persons + " assigned";
    this.element.querySelector("p")!.textContent = description;
  }
}

class ProjectList
  extends Component<HTMLDivElement, HTMLElement>
  implements DragTarget
{
  assignedProjects: Project[];

  constructor(private type: "active" | "finished") {
    super("project-list", "app", "beforeend", `${type}-projects`);

    this.assignedProjects = [];

    this.configure();
    this.renderContent();
  }

  private renderProjects() {
    const listEl = document.getElementById(
      `${this.type}-projects-list`
    )! as HTMLUListElement;

    listEl.innerHTML = "";

    for (const projItem of this.assignedProjects) {
      new ProjectItem(this.element.querySelector("ul")!.id, projItem);
    }
  }

  dragOverHandler(event: DragEvent) {
    if (event.dataTransfer && event.dataTransfer.types[0] === "text/plain") {
      event.preventDefault();
      const listEl = this.element.querySelector("ul")!;
      listEl.classList.add("droppable");
    }
  }
  dropHandler(event: DragEvent) {
    const projId = event.dataTransfer!.getData("text/plain");
    projectState.moveProject(
      projId,
      this.type === "active" ? ProjectStatus.Active : ProjectStatus.Finished
    );
  }

  dragLeaveHandler(_: DragEvent) {
    const listEl = this.element.querySelector("ul")!;
    listEl.classList.remove("droppable");
  }

  configure() {
    this.element.addEventListener("dragover", this.dragOverHandler.bind(this));
    this.element.addEventListener("drop", this.dropHandler.bind(this));
    this.element.addEventListener(
      "dragleave",
      this.dragLeaveHandler.bind(this)
    );

    projectState.addListener((projects: Project[]) => {
      const relevantProjects = projects.filter((proj) => {
        if (this.type === "active") {
          return proj.status === ProjectStatus.Active;
        }
        return proj.status === ProjectStatus.Finished;
      });
      this.assignedProjects = relevantProjects;
      this.renderProjects();
    });
  }

  renderContent() {
    const listId = `${this.type}-projects-list`;
    this.element.querySelector("ul")!.id = listId;
    this.element.querySelector("h2")!.textContent =
      this.type.toUpperCase() + " PROJECTS";
  }
}

class Input extends Component<HTMLDivElement, HTMLFormElement> {
  titleInputElement: HTMLInputElement;
  descInputElement: HTMLInputElement;
  peopleInputElement: HTMLInputElement;

  constructor() {
    super("project-input", "app", "afterbegin", "user-input");

    this.titleInputElement = this.element.querySelector(
      "#title"
    ) as HTMLInputElement;
    this.descInputElement = this.element.querySelector(
      "#description"
    ) as HTMLInputElement;
    this.peopleInputElement = this.element.querySelector(
      "#people"
    ) as HTMLInputElement;

    this.configure();
  }

  private getUserInput(): [string, string, number] | void {
    const title = this.titleInputElement.value;
    const description = this.descInputElement.value;
    const people = this.peopleInputElement.value;

    const titleValidatable: Validatable = {
      value: title,
      required: true,
    };

    const descValidatable: Validatable = {
      value: description,
      required: true,
      minLength: 5,
    };

    const peopleValidatable: Validatable = {
      value: people,
      required: true,
      min: 1,
      max: 5,
    };

    if (
      !validate(titleValidatable) ||
      !validate(descValidatable) ||
      !validate(peopleValidatable)
    ) {
      alert("Invalid input, please try again!");
      return;
    } else {
      return [title, description, +people];
    }
  }

  private clearInputs() {
    this.titleInputElement.value = "";
    this.descInputElement.value = "";
    this.peopleInputElement.value = "";
  }

  private submitHandler(event: Event) {
    event.preventDefault();

    const userInput = this.getUserInput();

    if (Array.isArray(userInput)) {
      const [title, description, people] = userInput;

      projectState.addProject(title, description, people);
      this.clearInputs();
    }
  }

  configure() {
    this.element.addEventListener("submit", this.submitHandler.bind(this));
  }

  renderContent() {}
}

function validate(validatableInput: Validatable) {
  let isValid = true;

  if (validatableInput.required) {
    isValid = isValid && validatableInput.value.toString().trim().length !== 0;
  }

  if (
    validatableInput.minLength != null &&
    typeof validatableInput.value === "string"
  ) {
    isValid =
      isValid && validatableInput.value.length > validatableInput.minLength;
  }

  if (
    validatableInput.maxLength != null &&
    typeof validatableInput.value === "string"
  ) {
    isValid =
      isValid && validatableInput.value.length < validatableInput.maxLength;
  }

  if (
    validatableInput.min != null &&
    typeof validatableInput.value === "number"
  ) {
    isValid = isValid && validatableInput.value > validatableInput.min;
  }

  if (
    validatableInput.max != null &&
    typeof validatableInput.value === "number"
  ) {
    isValid = isValid && validatableInput.value < validatableInput.max;
  }

  return isValid;
}

const projectState = ProjectState.getInstance();
const renderForm = new Input();
const activeProjects = new ProjectList("active");
const finishedProjects = new ProjectList("finished");
