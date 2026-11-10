import { createBrowserRouter, RouterProvider } from "react-router-dom"
import { RequireAuth, RequirePapel, HomeRedirect } from "./auth/guards.tsx"
import { Shell } from "./components/Shell.tsx"
import { AccessPage } from "./pages/AccessPage.tsx"
import { LessonPage } from "./pages/LessonPage.tsx"
import { LoginPage } from "./pages/LoginPage.tsx"
import { AgendaPage } from "./pages/school/AgendaPage.tsx"
import { BillingPage } from "./pages/school/BillingPage.tsx"
import { StudentsPage } from "./pages/school/StudentsPage.tsx"
import { TeacherPage } from "./pages/school/TeacherPage.tsx"
import { TeachersPage } from "./pages/school/TeachersPage.tsx"
import { SettingsPage } from "./pages/school/SettingsPage.tsx"
import { StudentPage } from "./pages/school/StudentPage.tsx"
import { TodayPage } from "./pages/school/TodayPage.tsx"
import { StudentAgendaPage } from "./pages/student/AgendaPage.tsx"
import { PaymentsPage } from "./pages/student/PaymentsPage.tsx"

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined

const router = createBrowserRouter(
  [
    { path: "/login", element: <LoginPage /> },
    { path: "/acesso", element: <AccessPage /> },
    { path: "/", element: <HomeRedirect /> },
    {
      element: <RequireAuth />,
      children: [
        {
          element: <Shell />,
          children: [
            {
              element: <RequirePapel papel="aluno" />,
              children: [
                { path: "/aluno", element: <StudentAgendaPage /> },
                { path: "/aluno/pagamentos", element: <PaymentsPage /> },
                { path: "/aluno/aulas/:id", element: <LessonPage /> },
              ],
            },
            {
              element: <RequirePapel papel="professor" />,
              children: [
                { path: "/professor", element: <AgendaPage mode="professor" /> },
                { path: "/professor/aulas/:id", element: <LessonPage /> },
              ],
            },
            {
              element: <RequirePapel papel="administrador" />,
              children: [
                { path: "/escola", element: <TodayPage /> },
                { path: "/escola/agenda", element: <AgendaPage mode="escola" /> },
                { path: "/escola/alunos", element: <StudentsPage /> },
                { path: "/escola/alunos/:id", element: <StudentPage /> },
                { path: "/escola/professores", element: <TeachersPage /> },
                { path: "/escola/professores/:id", element: <TeacherPage /> },
                { path: "/escola/mensalidades", element: <BillingPage /> },
                { path: "/escola/configuracao", element: <SettingsPage /> },
                { path: "/escola/aulas/:id", element: <LessonPage /> },
              ],
            },
          ],
        },
      ],
    },
  ],
  { basename },
)

export default function App() {
  return <RouterProvider router={router} />
}
