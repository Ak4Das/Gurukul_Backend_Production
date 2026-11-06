```
THREE POINTS TO CHECK
- I can explain each line of code if given
- I can justify technical decisions
- I can explain the workflow
```

# /routes/Users.js

## GET /users - List users

## POST /users - Create new user
1. username, password, fullName, role, status, gender are required fields if not pass then return response with error
2. Check duplicate username
3. Check email and mobile uniqueness only for admin, clerk, supervisor, teacher, parent
4. Create User using User.create()

## PUT /users/:id - Update user details
1. Check user exists or not using User.findById(req.params.id)
2. Check duplicate username if username is changing
3. Check email and mobile uniqueness only for admin, clerk, supervisor, teacher, parent if email and mobile number is changing
4. Save user using user.save() (here user is the user document fetched at the first time when we check user exists or not)

## POST /users/:id/reset-password
1. get id from req.params and oldPassword, newPassword from req.body
2. check id is valid or not
3. check is oldPassword and newPassword are present and is they are grater then 6 characters
4. check is oldPassword and newPassword are same
5. then compare the oldPassword with user password stored in database using bcrypt.compare
6. save user using user.save()

## /users/:id/status
1. get id from req.params and validate id
2. get status from req.body and check the status is valid or not
3. update user data in database using User.findByIdAndUpdate()

## DELETE /users/:id - Delete 
1. get id from req.params and validate id
2. Check that is user want to delete its own account if yes then prevent him/her
3. Delete user using User.findByIdAndDelete()

# /routes/timetables.js

## POST /api/timetables/:classId
1. get classId from req.params and then validate it 
2. fetch class using classId to check class exists or not
3. check periods is array or not and periods length is grater than 0 or not
4. Check duplicate day + period combinations
5. Collect subject and teacher IDs and validate each subject and teacher ids
6. Fetch all referenced subjects from DB using subjectIds
7. Create subjectMap for efficient subject lookup
8. Check every subjectId from subjectIds that subject exists or not
9. Check subjects belong to the selected class
10. Fetch all referenced teachers from DB using teacherIds
11. Create teacherMap for efficient teacher lookup
12. Check every teacherId from teacherIds that teacher exists or not
13. Build timetable periods
14. uses Timetable.findOneAndUpdate() to create or edit timetable

## DELETE /api/timetables/:id
1. Get classId from req.params.classId and validate it
2. delete timetable using findOneAndDelete
