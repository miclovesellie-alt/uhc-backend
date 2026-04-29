import AdminLayout from "./admin/components/AdminLayout";
import AdminSettings from "./admin/pages/AdminSettings";

// Inside <Routes>:

<Route
  path="/admin"
  element={
    <PrivateRoute>
      <AdminLayout>
        <AdminDashboard />
      </AdminLayout>
    </PrivateRoute>
  }
/>

<Route
  path="/admin/users"
  element={
    <PrivateRoute>
      <AdminLayout>
        <AdminUsers />
      </AdminLayout>
    </PrivateRoute>
  }
/>

<Route
  path="/admin/questions"
  element={
    <PrivateRoute>
      <AdminLayout>
        <AdminQuestions />
      </AdminLayout>
    </PrivateRoute>
  }
/>

<Route
  path="/admin/settings"
  element={
    <PrivateRoute>
      <AdminLayout>
        <AdminSettings />
      </AdminLayout>
    </PrivateRoute>
  }
/>