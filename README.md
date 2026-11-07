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
4. Create Base user data and add email and mobile number only if user is not a student
5. Create User using User.create()

## PUT /users/:id - Update user details
1. Check user exists or not using User.findById(req.params.id)
2. Check duplicate username if username is changing
3. Check email and mobile uniqueness only for admin, clerk, supervisor, teacher, parent if email and mobile number is changing
4. if user is not a student
5. Save user using user.save() (here user is the user document fetched at the first time when we check user exists or not)

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

## GET /api/timetables/:classId
1. get classId from req.params and then validate it 
2. check that class exists or not using Class.findOne({ _id: classId })
3. find timetable using Timetable.findOne({ classId }).lean()
4. send response

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
14. For create check timetable already exists or not using classId and then Timetable.create() to create timetable
15. For update check timetable already exists or not using timetableId 
16. Check duplicate timetable document using classId and _id: { $ne: timetableId }
17. Update using Timetable.findOneAndUpdate()

## DELETE /api/timetables/:id
1. Get classId from req.params.classId and validate it
2. delete timetable using findOneAndDelete

# /routes/subjects.js

## GET /api/subjects
1. find subjects using Subject.find().sort({ name: 1 }).lean()
2. send response

## GET /api/subjects/:id
1. get id from req.params.id and validate this id 
2. find subject using Subject.findById(req.params.id).lean()
3. send response

## POST /api/subjects/
1. subject name must be string and nonempty
2. subject code must be string and nonempty
3. category must be valid category
4. classIds must be valid ids
5. maxMarks must be number and grater then 0
6. passingMarks must be number and grater then 0
7. Passing marks cannot exceed maximum marks
8. Check duplicate subject code
9. Create subject using Subject.create()

## PUT /api/subjects/:id
1. subject name must be string and nonempty
2. subject code must be string and nonempty
3. category must be valid category
4. classIds must be valid ids
5. maxMarks must be number and grater then 0
6. passingMarks must be number and grater then 0
7. Passing marks cannot exceed maximum marks
8. Check duplicate subject code
9. Update subject using Subject.findByIdAndUpdate()

## DELETE /api/subjects/:id
1. get id from req.params.id and validate this id 
2. delete document using Subject.findByIdAndDelete(req.params.id).lean()
3. send response

# /routes/ptm.js

## GET /api/ptm
1. get ptm documents using Ptm.find().sort({ date: -1 }).lean()
2. send response

## GET /api/ptm/:id
1. get id from req.params.id and validate this id 
2. find ptm using Ptm.findById()
3. send response

## POST /api/ptm
1. title must be string and must be non empty
2. date must be string and must be in yyyy-mm-dd format
3. Validate that the date is an actual calendar date
4. Validate that PTM date is not in the past
4. slots must be string and must be non empty
5. check at least one class is required and class Ids must be valid ids
6. Prevent duplicate class IDs
7. check that status must be valid status
8. notes must be string and must be non empty
9. Verify that all referenced classes exist
10. Create ptm using Ptm.create()

## PUT /api/ptm/:id
1. title must be string and must be non empty
2. date must be string and must be in yyyy-mm-dd format
3. Validate that the date is an actual calendar date
4. Validate that PTM date is not in the past
4. slots must be string and must be non empty
5. check at least one class is required and class Ids must be valid ids
6. Prevent duplicate class IDs
7. check that status must be valid status
8. notes must be string and must be non empty
9. Verify that all referenced classes exist
10. Create ptm using Ptm.findByIdAndUpdate()

## DELETE /api/ptm/:id
1. get id from req.params.id and validate it
2. delete ptm using Ptm.findByIdAndDelete()
3. send response

# /routes/notices.js

## GET /api/notices/:id
1. get id from req.params.id and validate it
2. find notice using Notice.findById(req.params.id).lean()
3. return response

## POST /api/notices
1. title must be string and must be non empty
2. content must be string and must be non empty
2. date must be string and must be in yyyy-mm-dd format
3. Validate that the date is an actual calendar date
4. Validate that date is not in the past
4. Check that status must be a valid status
5. check that audience must be a valid audience
6. Create notice using Notice.create()

## PUT /api/notices/:id
1. get id from req.params.id and validate it
1. title must be string and must be non empty
2. content must be string and must be non empty
2. date must be string and must be in yyyy-mm-dd format
3. Validate that the date is an actual calendar date
4. Validate that date is not in the past
4. Check that status must be a valid status
5. check that audience must be a valid audience
6. Update notice using Notice.findByIdAndUpdate()

## DELETE /api/notices/:id
1. get id from req.params.id and validate it
2. delete notice using Notice.findByIdAndDelete()
3. return response

# /routes/logbook.js

## POST /api/logbook
1. teacherName must be string and must be non empty
2. validate classId
3. validate subjectId
4. date must be string and must be in yyyy-mm-dd format
5. Check whether date is a real calendar date
6. Validate that date is not in the past
7. topicCovered must be string and must be non empty
8. homeworkGiven must be string
9. remarks must be string
10. Create logbook using Logbook.create()

## PUT /api/logbook/:id
1. teacherName must be string and must be non empty
2. validate classId
3. validate subjectId
4. date must be string and must be in yyyy-mm-dd format
5. Check whether date is a real calendar date
6. Validate that date is not in the past
7. topicCovered must be string and must be non empty
8. homeworkGiven must be string
9. remarks must be string
10. Update logbook using Logbook.findByIdAndUpdate()

## DELETE /api/logbook/:id
1. get id from req.params.id and validate it
2. delete logbook using Logbook.findByIdAndDelete()
3. return response