<?php  
namespace app\admin\controller;
/**
* 分类管理的控制器
*/
class Cate extends Common
{
	
	public function catelist(){
		//商品列表的方法
		$cate_select = db('cate')->order('cate_sort')->select();
		$cate_model = model('Cate');
		$cate_list = $cate_model->getChildrenId($cate_select);

		$cate_totle = count($cate_list);//得到数据总数
		$page_class = new \app\admin\controller\Page($cate_totle,100);
		$show = $page_class->fpage();//模板显示的内容
		$limit = $page_class->setlimit();//获取limit信息   '3,2'
		$limit = explode(',',$limit);//['3','2']
		$list = array_slice($cate_list,$limit[0],$limit[1]);//123456

		$this->assign('show',$show);
		$this->assign('cate_list',$list);

		


		return view();
	}

	public function add(){
		//添加商品界面显示
		$cate_select = db('cate')->select();
		$cate_model = model('Cate');
		$cate_list = $cate_model->getChildrenId($cate_select);
		//获取无限级分类列表
		$this->assign('cate_list',$cate_list);
		return view();
	}

	public function addhanddle(){
		//添加分类提交的处理
		$post = request()->post();
		$cate_add = db('cate')->insert($post);
		if ($cate_add) {
			$this->success('分类添加成功','cate/catelist');
		}
		else{
			$this->error('分类添加失败','cate/catelist');
		}
	}

	public function upd($cate_id=''){
		//显示分类修改界面
		if ($cate_id=='') {
			$this->redirect('cate/catelist');
		}
		$cate_find = db('cate')->find($cate_id);
		if ($cate_find=='') {
			$this->redirect('cate/catelist');
		}
		$cate_select = db('cate')->select();
		$cate_model = model('Cate');
		$cate_list = $cate_model->getChildrenId($cate_select);
		//获取无限级分类列表
		$this->assign('cate_list',$cate_list);
		$this->assign('cate_find',$cate_find);
		return view();
	}

	public function updhanddle(){
		//分类修改提交处理
		$post = request()->post();
		$cate_upd_result = db('cate')->update($post);
		if ($cate_upd_result!==false) {
			$this->success('分类修改成功','cate/catelist');
		}
		else{
			$this->error('分类修改失败','cate/catelist');
		}
	}

	public function del($cate_id=''){
		//分类删除的方法
		if ($cate_id=='') {
			$this->redirect('cate/catelist');
		}
		$cate_find = db('cate')->find($cate_id);
		if ($cate_find=='') {
			$this->redirect('cate/catelist');
		}

		$cate_select = db('cate')->select();
		$cate_model = model('Cate');
		$cate_list = $cate_model->getChildrenId($cate_select,$cate_id);
		//得到全部子类
		$cate_list[] = $cate_find;
		foreach ($cate_list as $key => $value) {
			db('cate')->where('cate_id',$value['cate_id'])->delete();
		}
		$this->redirect('cate/catelist');
	}



	public function sort(){
		//对分类进行排序的方法
		$post = request()->post();
		foreach ($post as $key => $value) {
			db('cate')->update([
				'cate_id'	=>	$key,
				'cate_sort'=>	$value,
				]);
		}
		$this->redirect('cate/catelist');
	}

}
?>