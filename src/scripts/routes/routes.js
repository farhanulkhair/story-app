import HomePage from "../pages/home/home-page";
import HomePresenter from "../pages/home/home-presenter";
import AddPage from "../pages/add/add-page";
import AboutPage from "../pages/about/about-page";
import LoginPage from "../pages/auth/login/login-page";
import RegisterPage from "../pages/auth/register/register-page";
import StoryDetailPage from "../pages/story-detail/story-detail-page";

const routes = {
  "/login": new LoginPage(),
  "/register": new RegisterPage(),

  "/": () => {
    const view = new HomePage();
    const presenter = new HomePresenter(view);
    view.setPresenter(presenter);
    return view;
  }, // default page
  "/home": () => {
    const view = new HomePage();
    const presenter = new HomePresenter(view);
    view.setPresenter(presenter);
    return view;
  },
  "/add": new AddPage(),
  "/about": new AboutPage(),
  "/detail/:id": () => new StoryDetailPage(),
};

export default routes;